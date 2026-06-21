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
    if (!result?.points?.length) return null;
    const waveform = buildNativeWaveform(song, result, durationMs, pointCount);
    return waveform.sourceKey === sourceKey ? waveform : null;
  } catch {
    return null;
  }
};
