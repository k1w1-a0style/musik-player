import { getCachedWaveformForSong } from './waveformSourceCache';
import type { Song } from '../types/Song';
import { peekCachedWaveform, setCachedWaveform } from './waveformCache';
import { extractNativeWaveform, resolveWaveformUri } from './waveformExtraction';
import {
  WAVEFORM_EXTRACTION_DEBOUNCE_MS,
  type WaveformExtractionPriority,
} from './waveformExtractionLifecycle';
import { getWaveformSourceIdentity } from './waveformGenerator';
import { logWaveformDecision } from './waveformTelemetry';
import { WAVEFORM_CACHE_POINT_COUNT, type SongWaveform } from './waveformTypes';
import type { WaveformSourceDiagnostics } from './waveformDecision';

const MAX_IN_FLIGHT_WAVEFORM_PRELOADS = 4;
export const MAX_BACKGROUND_WAVEFORM_PRELOAD_DURATION_MS = 20 * 60 * 1000;
interface PreloadFlight { controller: AbortController; promise: Promise<SongWaveform | null>; waiters: number }
const preloadFlights = new Map<string, PreloadFlight>();
type WaveformPreloadPriority = Extract<WaveformExtractionPriority, 'preload' | 'background'>;

interface WaveformPreloadOptions {
  priority?: WaveformPreloadPriority;
  signal?: AbortSignal;
}

const preloadKey = (song: Song, priority: WaveformPreloadPriority): string => {
  const identity = getWaveformSourceIdentity(song);
  return `${identity.sourceKey}|${identity.sourceFingerprint}|${priority}`;
};

const nativeMemoryHit = (song: Song): SongWaveform | null => {
  const cached = peekCachedWaveform(getWaveformSourceIdentity(song));
  return cached?.source === 'native' ? cached : null;
};

const waitForForegroundToStart = (): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, WAVEFORM_EXTRACTION_DEBOUNCE_MS));

const extractPreload = async (
  song: Song,
  durationMs: number,
  priority: WaveformPreloadPriority,
  signal: AbortSignal,
): Promise<{
  waveform: SongWaveform | null;
  schedulerDeferred: boolean;
}> => {
  let schedulerDeferred = false;
  const onDecision = (diagnostics: WaveformSourceDiagnostics): void => {
    if (diagnostics.decision === 'native-scheduler-unavailable') schedulerDeferred = true;
    logWaveformDecision(diagnostics);
  };
  const waveform = await extractNativeWaveform(song, durationMs, {
    pointCount: WAVEFORM_CACHE_POINT_COUNT,
    priority,
    signal,
    onDecision,
  });
  return { waveform, schedulerDeferred };
};

const extractWhenForegroundStarted = async (song: Song, durationMs: number,
  priority: WaveformPreloadPriority, signal: AbortSignal): Promise<SongWaveform | null> => {
  const firstAttempt = await extractPreload(song, durationMs, priority, signal);
  if (signal.aborted) return null;
  if (!firstAttempt.waveform && firstAttempt.schedulerDeferred) {
    // Retry once after the foreground debounce has given its decoder priority.
    await waitForForegroundToStart();
  }
  if (signal.aborted) return null;
  const memoryHit = nativeMemoryHit(song);
  if (memoryHit) return memoryHit;
  return firstAttempt.waveform ?? (firstAttempt.schedulerDeferred
    ? (await extractPreload(song, durationMs, priority, signal)).waveform : null);
};

const loadPreloadedWaveform = async (
  song: Song,
  priority: WaveformPreloadPriority,
  signal: AbortSignal,
): Promise<SongWaveform | null> => {
  const identity = getWaveformSourceIdentity(song);
  const cached = await getCachedWaveformForSong(song).catch(() => null);
  if (signal.aborted) return null;
  if (cached?.source === 'native') return cached;

  // A foreground request may have completed while persistent storage was read.
  const racedMemoryHit = peekCachedWaveform(identity);
  if (racedMemoryHit?.source === 'native') return racedMemoryHit;

  const durationMs = song.duration ?? song.audioInfo?.durationMs ?? 0;
  // Full-file decoding is appropriate for a visible foreground waveform, but
  // spending that CPU budget speculatively on podcasts, mixes, or audiobooks
  // is not. A persisted hit above still remains reusable for long-form tracks.
  if (!Number.isFinite(durationMs) || durationMs > MAX_BACKGROUND_WAVEFORM_PRELOAD_DURATION_MS) {
    return null;
  }
  const waveform = await extractWhenForegroundStarted(song, durationMs, priority, signal);
  if (!waveform || signal.aborted) return null;

  // Native decoder work is shared, but persistence remains independently
  // retryable: a failed foreground write must not suppress this background one.
  await setCachedWaveform(waveform);
  return waveform;
};

const joinPreload = (flight: PreloadFlight, signal?: AbortSignal): Promise<SongWaveform | null> => {
  if (signal?.aborted) return Promise.resolve(null);
  flight.waiters += 1;
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (): boolean => {
      if (finished) return false;
      finished = true;
      flight.waiters -= 1;
      signal?.removeEventListener('abort', abort);
      return true;
    };
    const abort = (): void => {
      if (!finish()) return;
      resolve(null);
      // React's effect cleanup/setup can promote the next track in one turn.
      // Let its new consumer join before cancelling truly abandoned work.
      void Promise.resolve().then(() => { if (!flight.waiters) flight.controller.abort(); });
    };
    signal?.addEventListener('abort', abort, { once: true });
    flight.promise.then(value => { if (finish()) resolve(value); }, error => { if (finish()) reject(error); });
  });
};

/** Shared cache warming remains alive only while a current/adjacent view needs it. */
export const preloadSongWaveform = (
  song: Song | null | undefined,
  options: WaveformPreloadOptions = {},
): Promise<SongWaveform | null> => {
  if (options.signal?.aborted || !song || !resolveWaveformUri(song)) return Promise.resolve(null);
  const memoryHit = nativeMemoryHit(song);
  if (memoryHit) return Promise.resolve(memoryHit);

  const priority = options.priority ?? 'preload';
  const key = preloadKey(song, priority);
  const existing = preloadFlights.get(key);
  if (existing && !existing.controller.signal.aborted) return joinPreload(existing, options.signal);
  for (const [oldKey, flight] of preloadFlights) {
    if (!flight.waiters) { flight.controller.abort(); preloadFlights.delete(oldKey); }
  }
  if (preloadFlights.size >= MAX_IN_FLIGHT_WAVEFORM_PRELOADS) return Promise.resolve(null);

  const flight: PreloadFlight = { controller: new AbortController(), promise: Promise.resolve(null), waiters: 0 };
  flight.promise = loadPreloadedWaveform(song, priority, flight.controller.signal).finally(() => {
    if (preloadFlights.get(key) === flight) preloadFlights.delete(key);
  });
  preloadFlights.set(key, flight);
  return joinPreload(flight, options.signal);
};

export const resetWaveformPreloadStateForTests = (): void => {
  for (const flight of preloadFlights.values()) flight.controller.abort();
  preloadFlights.clear();
};
