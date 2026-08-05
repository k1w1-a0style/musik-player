import { useEffect, useMemo, useState } from 'react';
import type { Song } from '../types/Song';
import { getCachedWaveform, setCachedWaveform } from '../utils/waveformCache';
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
  loadingNative: boolean;
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
  const [waveform, setWaveform] = useState<SongWaveform>(immediate);
  const [loadingNative, setLoadingNative] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setWaveform(immediate);

    if (!canExtractNative) {
      setLoadingNative(false);
      cacheWaveformObserved(immediate);
      return () => {
        active = false;
        controller.abort();
      };
    }

    setLoadingNative(true);

    void (async () => {
      const cached = await getCachedWaveformUntilAbort(sourceIdentity, controller.signal);
      if (!active) return;
      if (cached) {
        setWaveform(cached);
        // Native waveforms are stable for the same source identity. Do not
        // re-extract on every NowPlaying remount/track revisit.
        if (cached.source === 'native') {
          setLoadingNative(false);
          return;
        }
      }

      const nativeWaveform = await extractNativeWaveform(song, durationMs, {
        pointCount,
        signal: controller.signal,
        onDecision: onWaveformDecision,
      });
      if (!active) return;
      if (nativeWaveform) {
        setWaveform(nativeWaveform);
        cacheWaveformObserved(nativeWaveform);
      } else if (!cached) {
        cacheWaveformObserved(immediate);
      }
      setLoadingNative(false);
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [canExtractNative, durationMs, immediate, onWaveformDecision, pointCount, song, sourceIdentity]);

  return { waveform, sourceKey, loadingNative };
};
