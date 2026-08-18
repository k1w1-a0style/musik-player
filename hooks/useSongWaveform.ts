import { useEffect, useMemo, useRef, useState } from 'react';
import type { Song } from '../types/Song';
import { getCachedWaveform, peekCachedWaveform, setCachedWaveform } from '../utils/waveformCache';
import { buildImmediateWaveform, extractNativeWaveform, resolveWaveformUri } from '../utils/waveformExtraction';
import { getWaveformSourceIdentity } from '../utils/waveformGenerator';
import {
  describeWaveformDecision,
  isNativeWaveformRejectionNoteworthy,
  type WaveformSourceDiagnostics,
} from '../utils/waveformDecision';
import {
  DEFAULT_WAVEFORM_POINT_COUNT,
  type SongWaveform,
  type WaveformSourceIdentity,
} from '../utils/waveformTypes';

declare const __DEV__: boolean;

interface UseSongWaveformOptions {
  song: Song | null;
  durationMs: number;
  pointCount?: number;
  onWaveformDecision?: (diagnostics: WaveformSourceDiagnostics) => void;
}

/**
 * Default telemetry: only in dev builds and only when the native path was
 * attempted and then rejected. This surfaces MP3/M4A native-vs-fallback
 * differences with container + reason context without spamming production or
 * normal fallback-only devices.
 */
const loggedWaveformDecisionKeys = new Set<string>();

export const resetWaveformDecisionLogThrottleForTests = (): void => {
  loggedWaveformDecisionKeys.clear();
};

const getWaveformDecisionLogKey = (diagnostics: WaveformSourceDiagnostics): string => [
  diagnostics.source,
  diagnostics.decision,
  diagnostics.container ?? 'unknown',
].join('|');

export const logWaveformDecision = (diagnostics: WaveformSourceDiagnostics): void => {
  if (typeof __DEV__ !== 'undefined' && __DEV__ && isNativeWaveformRejectionNoteworthy(diagnostics.decision)) {
    const key = getWaveformDecisionLogKey(diagnostics);
    if (loggedWaveformDecisionKeys.has(key)) return;
    loggedWaveformDecisionKeys.add(key);
    // eslint-disable-next-line no-console
    console.info(describeWaveformDecision(diagnostics));
  }
};

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
  pointCount: number;
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

const useResolvedWaveform = ({ song, durationMs, pointCount, canExtractNative,
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
      const native = await extractNativeWaveform(requestedSong, durationRef.current, {
        pointCount, signal: controller.signal, onDecision: onWaveformDecision,
      });
      if (!active) return;
      commit(native);
      if (native) cacheWaveformObserved(native);
    })();
    return stop;
  }, [canExtractNative, onWaveformDecision, pointCount, sourceFingerprint, sourceKey]);

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
  const sourceIdentity = useMemo(() => getWaveformSourceIdentity(song), [song]);
  const sourceKey = sourceIdentity.sourceKey;
  const immediate = useMemo(
    () => buildImmediateWaveform(song, durationMs, pointCount),
    [durationMs, pointCount, song],
  );
  const canExtractNative = useMemo(() => Boolean(resolveWaveformUri(song)), [song]);
  const resolvedForSource = useResolvedWaveform({ song, durationMs, pointCount,
    canExtractNative, sourceIdentity, onWaveformDecision });
  const waveformReady = resolvedForSource?.waveform?.source === 'native';
  const waveform = resolvedForSource?.waveform ?? immediate;
  const loadingNative = canExtractNative && !resolvedForSource?.settled;

  return { waveform, sourceKey, waveformReady, loadingNative };
};
