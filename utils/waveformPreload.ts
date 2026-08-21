import type { Song } from '../types/Song';
import { getCachedWaveform, peekCachedWaveform, setCachedWaveform } from './waveformCache';
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
const preloadFlights = new Map<string, Promise<SongWaveform | null>>();
type WaveformPreloadPriority = Extract<WaveformExtractionPriority, 'preload' | 'background'>;

interface WaveformPreloadOptions {
  priority?: WaveformPreloadPriority;
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
    onDecision,
  });
  return { waveform, schedulerDeferred };
};

const loadPreloadedWaveform = async (
  song: Song,
  priority: WaveformPreloadPriority,
): Promise<SongWaveform | null> => {
  const identity = getWaveformSourceIdentity(song);
  const cached = await getCachedWaveform(identity).catch(() => null);
  if (cached?.source === 'native') return cached;

  // A foreground request may have completed while persistent storage was read.
  const racedMemoryHit = peekCachedWaveform(identity);
  if (racedMemoryHit?.source === 'native') return racedMemoryHit;

  const durationMs = song.duration ?? song.audioInfo?.durationMs ?? 0;
  const firstAttempt = await extractPreload(song, durationMs, priority);
  if (!firstAttempt.waveform && firstAttempt.schedulerDeferred) {
    // The foreground debounce is finite. Retry once after it has started so
    // this preload can occupy the low-priority slot behind it.
    await waitForForegroundToStart();
  }
  const afterWaitMemoryHit = nativeMemoryHit(song);
  if (afterWaitMemoryHit) return afterWaitMemoryHit;
  const waveform = firstAttempt.waveform
    ?? (firstAttempt.schedulerDeferred
      ? (await extractPreload(song, durationMs, priority)).waveform
      : null);
  if (!waveform) return null;

  // Native decoder work is shared, but persistence remains independently
  // retryable: a failed foreground write must not suppress this background one.
  await setCachedWaveform(waveform);
  return waveform;
};

/**
 * Best-effort, bounded cache warming. It deliberately outlives the rendering
 * component so promotion from "next" to "current" can join the same native
 * flight instead of cancelling and restarting decoder work.
 */
export const preloadSongWaveform = (
  song: Song | null | undefined,
  options: WaveformPreloadOptions = {},
): Promise<SongWaveform | null> => {
  if (!song || !resolveWaveformUri(song)) return Promise.resolve(null);
  const memoryHit = nativeMemoryHit(song);
  if (memoryHit) return Promise.resolve(memoryHit);

  const priority = options.priority ?? 'preload';
  const key = preloadKey(song, priority);
  const existing = preloadFlights.get(key);
  if (existing) return existing;
  if (preloadFlights.size >= MAX_IN_FLIGHT_WAVEFORM_PRELOADS) return Promise.resolve(null);

  const flight = loadPreloadedWaveform(song, priority);
  const tracked = flight.finally(() => {
    if (preloadFlights.get(key) === tracked) preloadFlights.delete(key);
  });
  preloadFlights.set(key, tracked);
  return tracked;
};

export const resetWaveformPreloadStateForTests = (): void => {
  preloadFlights.clear();
};
