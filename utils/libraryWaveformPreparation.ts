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
import { loadPreparedSources, queueSongPrepared } from './songPreparationStore';
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
let deferredSongs: Song[] = [];
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

type PreparationOutcome = 'cached' | 'prepared' | 'failed';
const prepareSong = async (song: Song, signal: AbortSignal): Promise<PreparationOutcome> => {
  const identity = getWaveformSourceIdentity(song);
  clearWaveformFailure(identity.sourceFingerprint);
  const deadline = Date.now() + WAVEFORM_SCHEDULER_WAIT_TIMEOUT_MS;
  for (let attempts = 0; attempts < MAX_WAVEFORM_CONTENTION_RETRIES; attempts += 1) {
    throwIfAborted(signal);
    const cached = await waitForPreparationStorage(() => getCachedWaveformForSong(song), signal);
    throwIfAborted(signal);
    if (cached?.source === 'native') return 'cached';
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
      return 'prepared';
    }
    if (!deferred) {
      setWaveformStatus(identity.sourceFingerprint, 'unavailable');
      return 'failed';
    }
    // Visible playback wins. Resume this same source after contention instead
    // of counting a preempted job as a corrupt file or abandoning the batch.
    if (Date.now() >= deadline) break;
    await waitForWaveformSchedulerAvailability(signal, 'background', deadline - Date.now());
  }
  setWaveformStatus(identity.sourceFingerprint, 'unavailable');
  return 'failed';
};

const prepareSongSafely = async (song: Song, signal: AbortSignal): Promise<boolean> => {
  try {
    const result = await prepareSong(song, signal);
    // Reusing durable data must not serialize historical completion again.
    if (result === 'prepared') queueSongPrepared(getWaveformSourceIdentity(song).sourceFingerprint);
    return result !== 'failed';
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
  const unfinished = state.status === 'running' || state.status === 'cancelled' ? lastSongs.slice(state.processed) : [];
  const queue = [...new Map([...deferredSongs, ...unfinished, ...songs]
    .map(song => [getWaveformSourceIdentity(song).sourceFingerprint, song])).values()];
  deferredSongs = [];
  active?.abort(new OperationAbortError('Preparation superseded'));
  const controller = new AbortController();
  active = controller;
  lastSongs = queue;
  const abort = () => controller.abort(new OperationAbortError('Preparation cancelled'));
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  beginMetadataRefreshActivity();
  publish({ ...idle, status: 'running', total: queue.length });
  try {
    // History is optional. Actual cache data, rather than this hydration, is
    // what decides whether a decoder is needed.
    void loadPreparedSources().catch(() => undefined);
    throwIfAborted(controller.signal);
    // prepareSong validates durable data once per source. Only real scheduler
    // contention retries recheck it, because playback may publish that data.
    // Count checked sources consistently, including already cached waveforms.
    for (const song of queue) {
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
export const clearWaveformPreparation = (): void => {
  if (state.status === 'running' || state.status === 'cancelled') deferredSongs = lastSongs.slice(state.processed);
  active?.abort(new OperationAbortError('New library operation'));
  active = null;
  publish(idle);
};
export const resetWaveformPreparationForTests = (): void => {
  active?.abort(); active = null; lastSongs = []; deferredSongs = []; state = idle; listeners.clear();
};

