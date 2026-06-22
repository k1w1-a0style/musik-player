import type { Song } from '../types/Song';
import { DEFAULT_WAVEFORM_POINT_COUNT, WAVEFORM_VERSION, type NativeWaveformResult, type SongWaveform } from './waveformTypes';

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export const hashWaveformIdentity = (value: string): number => {
  let hash = FNV_OFFSET;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash;
};

export const clampWaveformPoint = (value: number): number => {
  if (!Number.isFinite(value)) return 0.08;
  return Math.max(0.04, Math.min(1, value));
};

export const normalizeWaveformPoints = (points: readonly number[], targetCount = DEFAULT_WAVEFORM_POINT_COUNT): number[] => {
  const safeTarget = Math.max(8, Math.min(160, Math.floor(targetCount)));
  const safePoints = points.map(clampWaveformPoint);
  if (safePoints.length === 0) return buildSyntheticPoints('empty', safeTarget);
  if (safePoints.length === safeTarget) return safePoints;

  return Array.from({ length: safeTarget }, (_, index) => {
    const start = Math.floor(index * safePoints.length / safeTarget);
    const end = Math.max(start + 1, Math.ceil((index + 1) * safePoints.length / safeTarget));
    let max = 0;
    for (let sampleIndex = start; sampleIndex < Math.min(end, safePoints.length); sampleIndex += 1) {
      max = Math.max(max, safePoints[sampleIndex]);
    }
    return clampWaveformPoint(max);
  });
};

const buildSyntheticPoints = (identity: string, count: number): number[] => {
  let seed = hashWaveformIdentity(identity) || 1;
  return Array.from({ length: count }, (_, index) => {
    seed = Math.imul(seed ^ (index + 0x9e3779b9), FNV_PRIME) >>> 0;
    const noise = (seed % 1000) / 1000;
    const wave = Math.abs(Math.sin((index + 1) * 0.57 + (seed % 31)));
    const envelope = 0.36 + 0.44 * wave;
    return clampWaveformPoint(0.12 + envelope * 0.68 + noise * 0.18);
  });
};

export const getWaveformSourceKey = (song: Song | null | undefined): string => {
  if (!song) return 'no-song';
  const uri = song.fileInfo?.uri ?? song.uri ?? '';
  const size = song.fileInfo?.size ?? 0;
  const importedAt = song.fileInfo?.importedAt ?? 0;
  const duration = song.duration ?? song.audioInfo?.durationMs ?? 0;
  const identity = [song.id, uri, size, importedAt, duration].join('|');
  return hashWaveformIdentity(identity || 'no-song').toString(36);
};

export const buildFallbackWaveform = (
  song: Song | null | undefined,
  durationMs: number,
  pointCount = DEFAULT_WAVEFORM_POINT_COUNT,
): SongWaveform => {
  const sourceKey = getWaveformSourceKey(song);
  return {
    version: WAVEFORM_VERSION,
    points: buildSyntheticPoints(sourceKey, pointCount),
    durationMs: Number.isFinite(durationMs) && durationMs > 0 ? durationMs : song?.duration ?? song?.audioInfo?.durationMs ?? 0,
    sourceKey,
    source: 'fallback',
    generatedAt: Date.now(),
  };
};

export const buildNativeWaveform = (
  song: Song | null | undefined,
  result: NativeWaveformResult,
  fallbackDurationMs: number,
  pointCount = DEFAULT_WAVEFORM_POINT_COUNT,
): SongWaveform => ({
  version: WAVEFORM_VERSION,
  points: normalizeWaveformPoints(result.points, pointCount),
  durationMs: Number.isFinite(result.durationMs) && (result.durationMs ?? 0) > 0 ? result.durationMs as number : fallbackDurationMs,
  sourceKey: getWaveformSourceKey(song),
  source: 'native',
  generatedAt: Date.now(),
});
