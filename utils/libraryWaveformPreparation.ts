import { getCachedWaveformForSong } from './waveformSourceCache';
import { useSyncExternalStore } from 'react';
import type { Song } from '../types/Song';
import { setCachedWaveform } from './waveformCache';
import { extractNativeWaveform } from './waveformExtraction';
import { getWaveformSourceIdentity } from './waveformGenerator';
import { clearWaveformFailure, MAX_WAVEFORM_CONTENTION_RETRIES,
  waitForWaveformSchedulerAvailability, WAVEFORM_SCHEDULER_WAIT_TIMEOUT_MS } from './waveformExtractionLifecycle';
import { setWaveformStatus } from './waveformStatus';
import { OperationAbortError, isAbortError, throwIfAborted } from './withTimeout';
import { beginMetadataRefreshActivity, endMetadataRefreshActivity } from './metadataRefreshActivity';
import { loadPreparedSources, markSongPrepared } from './songPreparationStore';
import { PreparationStorageError, waitForPreparationStorage } from './preparationStorage';

export interface WaveformPreparationState {
  status: 'idle' | 'running' | 'cancelled' | 'completed' | 'failed';
  failure?: 'storage' | 'analysis';
  total: number;
  processed: number;
  ready: number;
  failed: number;
  currentTitle: string;
  currentFingerprint: string;
}
const idle: WaveformPreparationState = {
  status: 'idle', total: 0, processed: 0, ready: 0, failed: 0, currentTitle: '', currentFingerprint: '',
};
let state = idle;
let active: AbortController | null = null;
let lastSongs: Song[] = [];
const listeners = new Set<() => void>();
const publish = (next: WaveformPreparationState): void => {
  state = next;
  listeners.forEach(listener => listener());
};
export const getWaveformPreparationState = (): WaveformPreparationState => state;
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const useWaveformPreparation = (): WaveformPreparationState =>
  useSyncExternalStore(subscribe, getWaveformPreparationState, getWaveformPreparationState);

const prepareSong = async (song: Song, signal: AbortSignal): Promise<boolean> => {
  const identity = getWaveformSourceIdentity(song);
  clearWaveformFailure(identity.sourceFingerprint);
  const deadline = Date.now() + WAVEFORM_SCHEDULER_WAIT_TIMEOUT_MS;
  for (let attempts = 0; attempts < MAX_WAVEFORM_CONTENTION_RETRIES; attempts += 1) {
    throwIfAborted(signal);
    const cached = await waitForPreparationStorage(() => getCachedWaveformForSong(song), signal);
    throwIfAborted(signal);
    if (cached?.source === 'native') return true;
    let deferred = false;
    const waveform = await extractNativeWaveform(song, song.duration ?? song.audioInfo?.durationMs ?? 0, {
      priority: 'background', signal,
      onDecision: ({ decision }) => {
        deferred = decision === 'native-scheduler-unavailable' || decision === 'native-scheduler-preempted';
      },
    });
    throwIfAborted(signal);
    if (waveform) {
      await waitForPreparationStorage(() => setCachedWaveform(waveform), signal);
      return true;
    }
    if (!deferred) {
      setWaveformStatus(identity.sourceFingerprint, 'unavailable');
      return false;
    }
    // Visible playback wins. Resume this same source after contention instead
    // of counting a preempted job as a corrupt file or abandoning the batch.
    if (Date.now() >= deadline) break;
    await waitForWaveformSchedulerAvailability(signal, 'background', deadline - Date.now());
  }
  setWaveformStatus(identity.sourceFingerprint, 'unavailable');
  return false;
};

const prepareSongSafely = async (song: Song, signal: AbortSignal): Promise<boolean> => {
  try {
    const ready = await prepareSong(song, signal);
    if (ready) void markSongPrepared(getWaveformSourceIdentity(song).sourceFingerprint).catch(error => {
      console.warn('[Preparation] Completion could not be persisted.', error);
    });
    return ready;
  }
  catch (error) {
    if (isAbortError(error) || signal.aborted || error instanceof PreparationStorageError) throw error;
    setWaveformStatus(getWaveformSourceIdentity(song).sourceFingerprint, 'unavailable');
    return false;
  }
};

/** A row retry joins the scheduler without replacing or cancelling the library batch. */
export const retrySongPreparation = (song: Song): Promise<boolean> =>
  prepareSongSafely(song, new AbortController().signal);

/** Explicit import/refresh preparation: serial, cancellable, cache-backed and resumable. */
export const prepareLibraryWaveforms = async (
  songs: Song[], { signal }: { signal?: AbortSignal } = {},
): Promise<void> => {
  active?.abort(new OperationAbortError('Preparation superseded'));
  const controller = new AbortController();
  active = controller;
  lastSongs = [...songs];
  const abort = () => controller.abort(new OperationAbortError('Preparation cancelled'));
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  beginMetadataRefreshActivity();
  publish({ ...idle, status: 'running', total: songs.length });
  try {
    // History is optional. Actual cache data, rather than this hydration, is
    // what decides whether a decoder is needed.
    void loadPreparedSources().catch(() => undefined);
    throwIfAborted(controller.signal);
    // Validate actual durable data once. An old completion marker alone must
    // never skip a missing/corrupt waveform after restart or eviction.
    const pendingSongs: Song[] = [];
    for (const song of songs) {
      const cached = await waitForPreparationStorage(() => getCachedWaveformForSong(song), controller.signal);
      throwIfAborted(controller.signal);
      if (cached?.source !== 'native') pendingSongs.push(song);
    }
    publish({ ...idle, status: pendingSongs.length ? 'running' : 'completed', total: pendingSongs.length });
    for (const song of pendingSongs) {
      throwIfAborted(controller.signal);
      publish({ ...state, currentTitle: song.title, currentFingerprint: getWaveformSourceIdentity(song).sourceFingerprint });
      const ready = await prepareSongSafely(song, controller.signal);
      throwIfAborted(controller.signal);
      publish({ ...state, processed: state.processed + 1,
        ready: state.ready + Number(ready), failed: state.failed + Number(!ready) });
    }
    publish({ ...state, status: 'completed', currentTitle: '' });
  } catch (error) {
    if (active === controller) publish({ ...state, currentTitle: '',
      status: isAbortError(error) || controller.signal.aborted ? 'cancelled' : 'failed',
      failure: error instanceof PreparationStorageError ? 'storage' : 'analysis' });
  } finally {
    endMetadataRefreshActivity();
    signal?.removeEventListener('abort', abort);
    if (active === controller) active = null;
  }
};

export const cancelWaveformPreparation = (): void => active?.abort(new OperationAbortError('Preparation cancelled'));
export const resumeWaveformPreparation = (): Promise<void> => prepareLibraryWaveforms(lastSongs);
export const dismissWaveformPreparation = (): void => { if (!active) publish(idle); };
export const clearWaveformPreparation = (): void => {
  active?.abort(new OperationAbortError('New library operation'));
  active = null;
  publish(idle);
};
export const resetWaveformPreparationForTests = (): void => {
  active?.abort(); active = null; lastSongs = []; state = idle; listeners.clear();
};
