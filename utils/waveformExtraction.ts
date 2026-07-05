import SystemAudio from 'expo-system-audio';
import type { Song } from '../types/Song';
import { withTimeout } from './withTimeout';
import { buildFallbackWaveform, buildNativeWaveform, getWaveformSourceKey } from './waveformGenerator';
import { DEFAULT_WAVEFORM_POINT_COUNT, type SongWaveform } from './waveformTypes';
import {
  classifyWaveformContainer,
  type NativeWaveformDecision,
  type WaveformSourceDiagnostics,
} from './waveformDecision';

export const WAVEFORM_EXTRACTION_TIMEOUT_MS = 8_000;

export const resolveWaveformUri = (song: Song | null | undefined): string | undefined =>
  song?.fileInfo?.uri ?? song?.uri;

export const buildImmediateWaveform = (
  song: Song | null | undefined,
  durationMs: number,
  pointCount = DEFAULT_WAVEFORM_POINT_COUNT,
): SongWaveform => buildFallbackWaveform(song, durationMs, pointCount);

export const hasUsefulNativeShape = (points: readonly number[]): boolean => {
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
  options?: {
    pointCount?: number;
    signal?: AbortSignal;
    onDecision?: (diagnostics: WaveformSourceDiagnostics) => void;
  },
): Promise<SongWaveform | null> => {
  const uri = resolveWaveformUri(song);
  const sourceKey = getWaveformSourceKey(song);
  const pointCount = options?.pointCount ?? DEFAULT_WAVEFORM_POINT_COUNT;
  const container = classifyWaveformContainer(uri);
  const report = (decision: NativeWaveformDecision, nativePointCount: number): void => {
    options?.onDecision?.({
      container,
      decision,
      source: decision === 'native-accepted' ? 'native' : 'fallback',
      nativePointCount,
    });
  };
  const extractor = (SystemAudio as typeof SystemAudio & {
    extractWaveformPeaks?: (uri: string, pointCount?: number) => Promise<{ points: number[]; durationMs?: number } | null>;
  }).extractWaveformPeaks;

  if (!uri) {
    report('no-uri', 0);
    return null;
  }
  if (!extractor) {
    report('no-native-extractor', 0);
    return null;
  }

  try {
    const result = await withTimeout(
      extractor(uri, pointCount),
      WAVEFORM_EXTRACTION_TIMEOUT_MS,
      'Waveform extraction timed out',
      { signal: options?.signal },
    );
    const points = result?.points ?? [];
    if (!result || points.length === 0) {
      report('native-empty', 0);
      return null;
    }
    // MP3 and M4A run through the exact same useful-shape gate and
    // normalization; a flat/degenerate native envelope is rejected regardless
    // of container so the deterministic fallback wins consistently.
    if (!hasUsefulNativeShape(points)) {
      report('native-unusable-shape', points.length);
      return null;
    }
    const waveform = buildNativeWaveform(song, result, durationMs, pointCount);
    if (waveform.sourceKey !== sourceKey) {
      report('native-source-key-changed', points.length);
      return null;
    }
    report('native-accepted', points.length);
    return waveform;
  } catch {
    report('native-error', 0);
    return null;
  }
};
