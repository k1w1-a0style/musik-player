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
import type { NativeWaveformDecision } from './waveformDecision';

export interface WaveformPreparationState {
  status: 'idle' | 'running' | 'cancelled' | 'completed' | 'failed';
  failure?: 'storage' | 'analysis';
  total: number;
  processed: number;
  ready: number;
  failed: number;
  failedSongs?: readonly { song: Song; reason: string }[];
  currentTitle: string;
  currentFingerprint: string;
  pausedForPlayback?: true;
}
const idle: WaveformPreparationState = {
  status: 'idle', total: 0, processed: 0, ready: 0, failed: 0, currentTitle: '', currentFingerprint: '',
};
let state = idle;
let active: AbortController | null = null;
let lastSongs: Song[] = [];
let deferredSongs: Song[] = [];
let playbackActive = false;
let resumeAfterPlayback = false;
const listeners = new Set<() => void>();
const publish = (next: WaveformPreparationState): void => {
  state = next;
  listeners.forEach(listener => listener());
};
export const getWaveformPreparationState = (): WaveformPreparationState => state;
export const hasPendingWaveformPreparation = (): boolean => deferredSongs.length > 0;
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const useWaveformPreparation = (): WaveformPreparationState =>
  useSyncExternalStore(subscribe, getWaveformPreparationState, getWaveformPreparationState);

const MAX_REPORTED_FAILURES = 20;
type PreparationOutcome = { kind: 'cached' | 'prepared' } | { kind: 'failed'; reason: string };
const unavailableReason = 'Die Wellenform konnte nicht gelesen werden.';
const preparationFailureReason = (decision?: NativeWaveformDecision): string => {
  if (decision === 'native-timeout') return 'Die Waveform-Analyse hat zu lange gedauert.';
  if (decision === 'native-preview-unavailable') return 'Diese Version unterstützt keine Waveform-Vorschau für lange Titel.';
  if (decision === 'no-uri') return 'Es fehlt eine gültige Dateireferenz.';
  if (decision === 'native-scheduler-unavailable' || decision === 'native-scheduler-preempted') {
    return 'Der Audiodecoder ist vorübergehend belegt.';
  }
  return unavailableReason;
};

const prepareSong = async (song: Song, signal: AbortSignal): Promise<PreparationOutcome> => {
  const identity = getWaveformSourceIdentity(song);
  clearWaveformFailure(identity.sourceFingerprint);
  const deadline = Date.now() + WAVEFORM_SCHEDULER_WAIT_TIMEOUT_MS;
  for (let attempts = 0; attempts < MAX_WAVEFORM_CONTENTION_RETRIES; attempts += 1) {
    throwIfAborted(signal);
    const cached = await waitForPreparationStorage(() => getCachedWaveformForSong(song), signal);
    throwIfAborted(signal);
    if (cached?.source === 'native') return { kind: 'cached' };
    let decision: NativeWaveformDecision | undefined;
    const waveform = await extractNativeWaveform(song, song.duration ?? song.audioInfo?.durationMs ?? 0, {
      priority: 'background', signal,
      onDecision: result => { decision = result.decision; },
    });
    throwIfAborted(signal);
    if (waveform) {
      await waitForPreparationStorage(() => setCachedWaveform(waveform), signal);
      return { kind: 'prepared' };
    }
    if (decision !== 'native-scheduler-unavailable' && decision !== 'native-scheduler-preempted') {
      setWaveformStatus(identity.sourceFingerprint, 'unavailable');
      return { kind: 'failed', reason: preparationFailureReason(decision) };
    }
    // Visible playback wins. Resume this same source after contention instead
    // of counting a preempted job as a corrupt file or abandoning the batch.
    if (Date.now() >= deadline) break;
    await waitForWaveformSchedulerAvailability(signal, 'background', deadline - Date.now());
  }
  setWaveformStatus(identity.sourceFingerprint, 'unavailable');
  return { kind: 'failed', reason: preparationFailureReason('native-scheduler-unavailable') };
};

const prepareSongSafely = async (song: Song, signal: AbortSignal): Promise<PreparationOutcome> => {
  try {
    const result = await prepareSong(song, signal);
    // Reusing durable data must not serialize historical completion again.
    if (result.kind === 'prepared') queueSongPrepared(getWaveformSourceIdentity(song).sourceFingerprint);
    return result;
  }
  catch (error) {
    if (isAbortError(error) || signal.aborted || error instanceof PreparationStorageError) throw error;
    setWaveformStatus(getWaveformSourceIdentity(song).sourceFingerprint, 'unavailable');
    return { kind: 'failed', reason: unavailableReason };
  }
};

/** A row retry joins the scheduler without replacing or cancelling the library batch. */
export const retrySongPreparation = async (song: Song): Promise<boolean> => {
  const result = await prepareSongSafely(song, new AbortController().signal);
  if (result.kind === 'failed') return false;
  const fingerprint = getWaveformSourceIdentity(song).sourceFingerprint;
  const failedSongs = state.failedSongs?.filter(({ song: failedSong }) =>
    getWaveformSourceIdentity(failedSong).sourceFingerprint !== fingerprint);
  if (failedSongs && failedSongs.length < (state.failedSongs?.length ?? 0)) {
    publish({ ...state, failedSongs, failed: state.failed - 1, ready: state.ready + 1 });
  }
  return true;
};

const suspendBatchDuringPlayback = (total: number, signal?: AbortSignal): boolean => {
  if (!playbackActive || total === 0 || signal?.aborted) return false;
  active = null;
  resumeAfterPlayback = true;
  publish({ ...idle, status: 'cancelled', total, pausedForPlayback: true });
  return true;
};

const recordPreparationOutcome = (song: Song, result: PreparationOutcome): void => {
  const failedSongs = state.failedSongs ?? [];
  const failed = result.kind === 'failed';
  publish({ ...state, processed: state.processed + 1,
    ready: state.ready + Number(!failed), failed: state.failed + Number(failed),
    ...(failed && failedSongs.length < MAX_REPORTED_FAILURES
      ? { failedSongs: [...failedSongs, { song, reason: result.reason }] } : {}) });
};

/** Explicit import/refresh preparation: serial, cancellable, cache-backed and resumable. */
export const prepareLibraryWaveforms = async (
  songs: Song[], { signal }: { signal?: AbortSignal } = {},
): Promise<void> => {
  const unfinished = state.status === 'running' || state.status === 'cancelled' || state.status === 'failed' ? lastSongs.slice(state.processed) : [];
  const queue = [...new Map([...deferredSongs, ...unfinished, ...songs]
    .map(song => [getWaveformSourceIdentity(song).sourceFingerprint, song])).values()];
  deferredSongs = [];
  active?.abort(new OperationAbortError('Preparation superseded'));
  lastSongs = queue;
  if (suspendBatchDuringPlayback(queue.length, signal)) return;
  const controller = new AbortController();
  active = controller;
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
      const result = await prepareSongSafely(song, controller.signal);
      throwIfAborted(controller.signal);
      recordPreparationOutcome(song, result);
    }
    publish({ ...state, status: 'completed', currentTitle: '' });
  } catch (error) {
    if (active === controller) publish({ ...state, currentTitle: '',
      status: isAbortError(error) || controller.signal.aborted ? 'cancelled' : 'failed',
      ...(resumeAfterPlayback ? { pausedForPlayback: true as const } : {}),
      failure: error instanceof PreparationStorageError ? 'storage' : 'analysis' });
  } finally {
    endMetadataRefreshActivity();
    signal?.removeEventListener('abort', abort);
    if (active === controller) active = null;
  }
};

/** Optional analysis yields immediately to native playback and resumes the unfinished tail. */
export const setWaveformPreparationPlaybackActive = (playing: boolean): void => {
  if (playbackActive === playing) return;
  playbackActive = playing;
  if (playing && active) {
    resumeAfterPlayback = true;
    active.abort(new OperationAbortError('Preparation paused for playback'));
  } else if (!playing && resumeAfterPlayback) {
    resumeAfterPlayback = false;
    void prepareLibraryWaveforms([]);
  }
};

export const cancelWaveformPreparation = (): void => {
  resumeAfterPlayback = false;
  active?.abort(new OperationAbortError('Preparation cancelled'));
};
export const resumeWaveformPreparation = (): Promise<void> => prepareLibraryWaveforms(lastSongs);
export const clearWaveformPreparation = (): void => {
  if (state.status === 'running' || state.status === 'cancelled' || state.status === 'failed') deferredSongs = lastSongs.slice(state.processed);
  active?.abort(new OperationAbortError('New library operation'));
  active = null;
  resumeAfterPlayback = false;
  publish(idle);
};
export const resetWaveformPreparationForTests = (): void => {
  active?.abort(); active = null; lastSongs = []; deferredSongs = []; state = idle; listeners.clear();
  playbackActive = false; resumeAfterPlayback = false;
};

