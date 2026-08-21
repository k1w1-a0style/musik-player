import { useEffect, useMemo, useRef, useState } from 'react';
import type { Song } from '../types/Song';
import { getCachedWaveform, peekCachedWaveform, setCachedWaveform } from '../utils/waveformCache';
import { buildImmediateWaveform, extractNativeWaveform, resolveWaveformUri } from '../utils/waveformExtraction';
import { getWaveformSourceIdentity, normalizeWaveformPoints } from '../utils/waveformGenerator';
import type { WaveformSourceDiagnostics } from '../utils/waveformDecision';
import { logWaveformDecision } from '../utils/waveformTelemetry';
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
}

interface ResolvedWaveform {
  identity: WaveformSourceIdentity;
  waveform: SongWaveform | null;
  settled: boolean;
}

interface WaveformResolutionOptions {
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
  identity: WaveformSourceIdentity,
  signal: AbortSignal,
): Promise<SongWaveform | null> => new Promise(resolve => {
  let settled = false;
  const finish = (value: SongWaveform | null): void => {
    if (settled) return;
    settled = true;
    signal.removeEventListener('abort', abort);
    resolve(value);
  };
  const abort = () => finish(null);
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  void getCachedWaveform(identity).then(finish, () => finish(null));
});

const sameIdentity = (left: WaveformSourceIdentity, right: WaveformSourceIdentity): boolean =>
  left.sourceKey === right.sourceKey && left.sourceFingerprint === right.sourceFingerprint;

const useResolvedWaveform = ({ song, durationMs, canExtractNative,
  sourceIdentity, onWaveformDecision }: WaveformResolutionOptions): ResolvedWaveform | null => {
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
    let active = true;
    const controller = new AbortController();
    const requestedIdentity = { sourceKey, sourceFingerprint };
    const requestedSong = songRef.current;
    const stop = (): void => {
      active = false;
      controller.abort();
    };
    const commit = (waveform: SongWaveform | null): void => {
      if (active) setResolved({ identity: requestedIdentity, waveform, settled: true });
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

    void (async () => {
      const cached = await getCachedWaveformUntilAbort(requestedIdentity, controller.signal);
      if (!active) return;
      if (cached?.source === 'native') return commit(cached);
      const racedMemoryHit = peekCachedWaveform(requestedIdentity);
      if (racedMemoryHit?.source === 'native') return commit(racedMemoryHit);
      const native = await extractNativeWaveform(requestedSong, durationRef.current, {
        pointCount: WAVEFORM_CACHE_POINT_COUNT, signal: controller.signal,
        onDecision: onWaveformDecision,
      });
      if (!active) return;
      commit(native);
      if (native) cacheWaveformObserved(native);
    })();
    return stop;
  }, [canExtractNative, onWaveformDecision, sourceFingerprint, sourceKey]);

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
  const immediate = useMemo(
    () => buildImmediateWaveform(song, durationMs, displayPointCount),
    [displayPointCount, durationMs, song],
  );
  const canExtractNative = useMemo(() => Boolean(resolveWaveformUri(song)), [song]);
  const resolvedForSource = useResolvedWaveform({ song, durationMs,
    canExtractNative, sourceIdentity, onWaveformDecision });
  const waveformReady = resolvedForSource?.waveform?.source === 'native';
  const resolvedWaveform = resolvedForSource?.waveform;
  const waveform = useMemo(() => {
    const selected = resolvedWaveform ?? immediate;
    if (selected.points.length === displayPointCount) return selected;
    return { ...selected, points: normalizeWaveformPoints(selected.points, displayPointCount) };
  }, [displayPointCount, immediate, resolvedWaveform]);
  const loadingNative = canExtractNative && !resolvedForSource?.settled;

  return { waveform, sourceKey, waveformReady, loadingNative };
};
