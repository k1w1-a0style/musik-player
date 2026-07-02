import SystemAudio from 'expo-system-audio';
import type { Song } from '../types/Song';
import { withTimeout } from './withTimeout';
import { buildFallbackWaveform, buildNativeWaveform, getWaveformSourceKey } from './waveformGenerator';
import { DEFAULT_WAVEFORM_POINT_COUNT, type SongWaveform } from './waveformTypes';

export const WAVEFORM_EXTRACTION_TIMEOUT_MS = 8_000;

export const resolveWaveformUri = (song: Song | null | undefined): string | undefined =>
  song?.fileInfo?.uri ?? song?.uri;

export const buildImmediateWaveform = (
  song: Song | null | undefined,
  durationMs: number,
  pointCount = DEFAULT_WAVEFORM_POINT_COUNT,
): SongWaveform => buildFallbackWaveform(song, durationMs, pointCount);

const hasUsefulNativeShape = (points: readonly number[]): boolean => {
  const finite = points.filter(point => Number.isFinite(point));
  if (finite.length < 8) return false;
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const average = finite.reduce((sum, point) => sum + point, 0) / finite.length;
  const variance = finite.reduce((sum, point) => sum + (point - average) ** 2, 0) / finite.length;
  // MediaExtractor packet sizes can look almost fully flat for many compressed
  // files. In that case the deterministic JS waveform looks better and avoids
  // the "same thick wall for every track" effect.
  return max - min >= 0.18 && variance >= 0.006;
};

export const extractNativeWaveform = async (
  song: Song | null | undefined,
  durationMs: number,
  options?: { pointCount?: number; signal?: AbortSignal },
): Promise<SongWaveform | null> => {
  const uri = resolveWaveformUri(song);
  const sourceKey = getWaveformSourceKey(song);
  const pointCount = options?.pointCount ?? DEFAULT_WAVEFORM_POINT_COUNT;
  const extractor = (SystemAudio as typeof SystemAudio & {
    extractWaveformPeaks?: (uri: string, pointCount?: number) => Promise<{ points: number[]; durationMs?: number } | null>;
  }).extractWaveformPeaks;

  if (!uri || !extractor) return null;

  try {
    const result = await withTimeout(
      extractor(uri, pointCount),
      WAVEFORM_EXTRACTION_TIMEOUT_MS,
      'Waveform extraction timed out',
      { signal: options?.signal },
    );
    if (!result?.points?.length || !hasUsefulNativeShape(result.points)) return null;
    const waveform = buildNativeWaveform(song, result, durationMs, pointCount);
    return waveform.sourceKey === sourceKey ? waveform : null;
  } catch {
    return null;
  }
};
