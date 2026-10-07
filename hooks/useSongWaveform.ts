import { getCachedWaveformForSong } from '../utils/waveformSourceCache';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Song } from '../types/Song';
import { peekCachedWaveform, setCachedWaveform } from '../utils/waveformCache';
import { buildImmediateWaveform, extractNativeWaveform, resolveWaveformUri } from '../utils/waveformExtraction';
import { getWaveformSourceIdentity, normalizeWaveformPoints } from '../utils/waveformGenerator';
import type { WaveformSourceDiagnostics } from '../utils/waveformDecision';
import { clearWaveformFailure, MAX_WAVEFORM_CONTENTION_RETRIES,
  waitForWaveformSchedulerAvailability, WAVEFORM_SCHEDULER_WAIT_TIMEOUT_MS } from '../utils/waveformExtractionLifecycle';
import { setWaveformStatus } from '../utils/waveformStatus';
import { logWaveformDecision, logWaveformTiming } from '../utils/waveformTelemetry';
import {
  DEFAULT_WAVEFORM_POINT_COUNT,
  WAVEFORM_CACHE_POINT_COUNT,
  type SongWaveform,
  type WaveformSourceIdentity,
} from '../utils/waveformTypes';

interface UseSongWaveformOptions {
  song: Song | null;
  durationMs: number;
  pointCount?: number;
  onWaveformDecision?: (diagnostics: WaveformSourceDiagnostics) => void;
}

export { logWaveformDecision, resetWaveformDecisionLogThrottleForTests } from '../utils/waveformTelemetry';

interface UseSongWaveformResult {
  waveform: SongWaveform;
  sourceKey: string;
  waveformReady: boolean;
  loadingNative: boolean;
  retry: () => void;
}

interface ResolvedWaveform {
  identity: WaveformSourceIdentity;
  waveform: SongWaveform | null;
  settled: boolean;
}

export const WAVEFORM_CACHE_LOOKUP_TIMEOUT_MS = 5000;

interface WaveformResolutionOptions {
  retryCount: number;
  song: Song | null;
  durationMs: number;
  canExtractNative: boolean;
  sourceIdentity: WaveformSourceIdentity;
  onWaveformDecision: (diagnostics: WaveformSourceDiagnostics) => void;
}

const cacheWaveformObserved = (waveform: SongWaveform): void => {
  void setCachedWaveform(waveform).catch(() => undefined);
};

const getCachedWaveformUntilAbort = (
  song: Song | null,
  signal: AbortSignal,
): Promise<SongWaveform | null> => new Promise(resolve => {
  let settled = false;
  const finish = (value: SongWaveform | null): void => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
    resolve(value);
  };
  const abort = () => finish(null);
  const timer = setTimeout(() => finish(null), WAVEFORM_CACHE_LOOKUP_TIMEOUT_MS);
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) { abort(); return; }
  void getCachedWaveformForSong(song).then(finish, () => finish(null));
});

const sameIdentity = (left: WaveformSourceIdentity, right: WaveformSourceIdentity): boolean =>
  left.sourceKey === right.sourceKey && left.sourceFingerprint === right.sourceFingerprint;

const waitForNativeRetry = async (signal: AbortSignal, attempts: number, deadline: number): Promise<boolean> => {
  if (attempts >= MAX_WAVEFORM_CONTENTION_RETRIES || Date.now() >= deadline) return false;
  try { await waitForWaveformSchedulerAvailability(signal, 'foreground', deadline - Date.now()); return true; }
  catch { return false; }
};
const extractWhenCapacityRecovers = async (
  song: Song | null, duration: () => number, identity: WaveformSourceIdentity,
  signal: AbortSignal, onDecision: (decision: WaveformSourceDiagnostics) => void,
): Promise<SongWaveform | null> => {
  const deadline = Date.now() + WAVEFORM_SCHEDULER_WAIT_TIMEOUT_MS;
  for (let attempt = 1; attempt <= MAX_WAVEFORM_CONTENTION_RETRIES; attempt += 1) {
    if (signal.aborted) return null;
    const published = peekCachedWaveform(identity);
    if (published?.source === 'native') return published;
    let deferred = false;
    const waveform = await extractNativeWaveform(song, duration(), {
      pointCount: WAVEFORM_CACHE_POINT_COUNT, signal,
      onDecision: decision => {
        deferred = decision.decision === 'native-scheduler-unavailable' || decision.decision === 'native-scheduler-preempted';
        onDecision(decision);
      },
    });
    if (signal.aborted || waveform || !deferred) return waveform;
    if (!await waitForNativeRetry(signal, attempt, deadline)) break;
  }
  if (!signal.aborted) setWaveformStatus(identity.sourceFingerprint, 'unavailable');
  return null;
};
const resolveSongWaveform = async (
  song: Song | null, duration: () => number, identity: WaveformSourceIdentity,
  signal: AbortSignal, onDecision: (decision: WaveformSourceDiagnostics) => void,
): Promise<{ waveform: SongWaveform | null; source: 'cache' | 'native' }> => {
  const cached = await getCachedWaveformUntilAbort(song, signal);
  if (cached?.source === 'native') return { waveform: cached, source: 'cache' };
  return { waveform: await extractWhenCapacityRecovers(song, duration, identity, signal, onDecision), source: 'native' };
};

const useResolvedWaveform = ({ song, durationMs, canExtractNative,
  sourceIdentity, onWaveformDecision, retryCount }: WaveformResolutionOptions): ResolvedWaveform | null => {
  const songRef = useRef(song);
  const durationRef = useRef(durationMs);
  songRef.current = song;
  durationRef.current = durationMs;
  const synchronousCached = peekCachedWaveform(sourceIdentity);
  const [resolved, setResolved] = useState<ResolvedWaveform | null>(() => {
    const waveform = synchronousCached?.source === 'native' ? synchronousCached : null;
    return waveform || !canExtractNative
      ? { identity: sourceIdentity, waveform, settled: true }
      : null;
  });
  const { sourceKey, sourceFingerprint } = sourceIdentity;

  useEffect(() => {
    const startedAt = Date.now();
    let active = true;
    const controller = new AbortController();
    const requestedIdentity = { sourceKey, sourceFingerprint };
    const requestedSong = songRef.current;
    const stop = (): void => {
      active = false;
      controller.abort();
    };
    const commit = (waveform: SongWaveform | null, source: 'cache' | 'native' = 'cache'): void => {
      if (!active) return;
      logWaveformTiming(waveform ? source : 'unavailable', Date.now() - startedAt, waveform?.points.length ?? 0);
      setResolved({ identity: requestedIdentity, waveform, settled: true });
    };
    const cachedInMemory = peekCachedWaveform(requestedIdentity);
    if (cachedInMemory?.source === 'native') {
      commit(cachedInMemory);
      return stop;
    }
    if (!canExtractNative) {
      commit(null);
      return stop;
    }

    setResolved(null);
    void resolveSongWaveform(requestedSong, () => durationRef.current, requestedIdentity,
      controller.signal, onWaveformDecision).then(({ waveform, source }) => {
      if (!active) return;
      commit(waveform, source);
      if (waveform && source === 'native') cacheWaveformObserved(waveform);
    }).catch(() => commit(null, 'native'));
    return stop;
  }, [canExtractNative, onWaveformDecision, retryCount, sourceFingerprint, sourceKey]);

  if (resolved && sameIdentity(resolved.identity, sourceIdentity)) return resolved;
  return synchronousCached?.source === 'native'
    ? { identity: sourceIdentity, waveform: synchronousCached, settled: true }
    : null;
};

export const useSongWaveform = ({
  song,
  durationMs,
  pointCount = DEFAULT_WAVEFORM_POINT_COUNT,
  onWaveformDecision = logWaveformDecision,
}: UseSongWaveformOptions): UseSongWaveformResult => {
  const displayPointCount = Number.isFinite(pointCount)
    ? Math.max(8, Math.min(WAVEFORM_CACHE_POINT_COUNT, Math.floor(pointCount)))
    : DEFAULT_WAVEFORM_POINT_COUNT;
  const sourceIdentity = useMemo(() => getWaveformSourceIdentity(song), [song]);
  const sourceKey = sourceIdentity.sourceKey;
  const [retryCount, setRetryCount] = useState(0);
  const retry = useCallback(() => {
    clearWaveformFailure(sourceIdentity.sourceFingerprint);
    setRetryCount(count => count + 1);
  }, [sourceIdentity.sourceFingerprint]);
  const immediate = useMemo(
    () => buildImmediateWaveform(song, durationMs, displayPointCount),
    [displayPointCount, durationMs, song],
  );
  const canExtractNative = useMemo(() => Boolean(resolveWaveformUri(song)), [song]);
  const resolvedForSource = useResolvedWaveform({ song, durationMs,
    canExtractNative, sourceIdentity, onWaveformDecision, retryCount });
  const waveformReady = resolvedForSource?.waveform?.source === 'native';
  const resolvedWaveform = resolvedForSource?.waveform;
  const waveform = useMemo(() => {
    const selected = resolvedWaveform ?? immediate;
    if (selected.points.length === displayPointCount) return selected;
    return { ...selected, points: normalizeWaveformPoints(selected.points, displayPointCount) };
  }, [displayPointCount, immediate, resolvedWaveform]);
  const loadingNative = canExtractNative && !resolvedForSource?.settled;

  return { waveform, sourceKey, waveformReady, loadingNative, retry };
};
