import { useEffect, useMemo, useState } from 'react';
import type { Song } from '../types/Song';
import { getCachedWaveform, setCachedWaveform } from '../utils/waveformCache';
import { buildImmediateWaveform, extractNativeWaveform, resolveWaveformUri } from '../utils/waveformExtraction';
import { getWaveformSourceKey } from '../utils/waveformGenerator';
import { DEFAULT_WAVEFORM_POINT_COUNT, type SongWaveform } from '../utils/waveformTypes';

interface UseSongWaveformOptions {
  song: Song | null;
  durationMs: number;
  pointCount?: number;
}

interface UseSongWaveformResult {
  waveform: SongWaveform;
  sourceKey: string;
  loadingNative: boolean;
}

export const useSongWaveform = ({
  song,
  durationMs,
  pointCount = DEFAULT_WAVEFORM_POINT_COUNT,
}: UseSongWaveformOptions): UseSongWaveformResult => {
  const sourceKey = useMemo(() => getWaveformSourceKey(song), [song]);
  const immediate = useMemo(
    () => buildImmediateWaveform(song, durationMs, pointCount),
    [durationMs, pointCount, song],
  );
  const canExtractNative = useMemo(() => Boolean(resolveWaveformUri(song)), [song]);
  const [waveform, setWaveform] = useState<SongWaveform>(immediate);
  const [loadingNative, setLoadingNative] = useState(false);

  useEffect(() => {
    let active = true;
    setWaveform(immediate);

    if (!canExtractNative) {
      setLoadingNative(false);
      void setCachedWaveform(immediate);
      return () => {
        active = false;
      };
    }

    setLoadingNative(true);

    void (async () => {
      const cached = await getCachedWaveform(sourceKey);
      if (!active) return;
      if (cached) {
        setWaveform(cached);
        // Native waveforms are stable for the same sourceKey. Do not re-extract
        // on every NowPlaying remount/track revisit; that was a hidden perf cost.
        if (cached.source === 'native') {
          setLoadingNative(false);
          return;
        }
      }

      const nativeWaveform = await extractNativeWaveform(song, durationMs, { pointCount });
      if (!active) return;
      if (nativeWaveform) {
        setWaveform(nativeWaveform);
        void setCachedWaveform(nativeWaveform);
      } else if (!cached) {
        void setCachedWaveform(immediate);
      }
      setLoadingNative(false);
    })();

    return () => {
      active = false;
    };
  }, [canExtractNative, durationMs, immediate, pointCount, song, sourceKey]);

  return { waveform, sourceKey, loadingNative };
};
