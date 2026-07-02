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

const nextSeed = (seed: number, salt: number): number => Math.imul(seed ^ salt, FNV_PRIME) >>> 0;

const buildSyntheticPoints = (identity: string, count: number): number[] => {
  const identityHash = hashWaveformIdentity(identity) || 1;
  let seed = identityHash;
  const phaseA = (identityHash % 628) / 100;
  const phaseB = ((identityHash >>> 8) % 628) / 100;
  const tempoA = 0.19 + ((identityHash >>> 4) % 17) / 100;
  const tempoB = 0.37 + ((identityHash >>> 12) % 23) / 100;

  return Array.from({ length: count }, (_, index) => {
    seed = nextSeed(seed, index + 0x9e3779b9);
    const noise = ((seed % 1000) / 1000) - 0.5;
    const slow = 0.5 + 0.5 * Math.sin(index * tempoA + phaseA);
    const fast = 0.5 + 0.5 * Math.sin(index * tempoB + phaseB);
    const transient = ((seed >>> 11) % 13 === 0) ? 0.32 : 0;
    const valley = ((seed >>> 17) % 11 === 0) ? -0.22 : 0;
    const value = 0.10 + slow * 0.34 + fast * 0.22 + noise * 0.20 + transient + valley;
    return clampWaveformPoint(value);
  });
};

export const getWaveformSourceKey = (song: Song | null | undefined): string => {
  if (!song) return 'no-song';
  const uri = song.fileInfo?.uri ?? song.uri ?? '';
  const size = song.fileInfo?.size ?? 0;
  const importedAt = song.fileInfo?.importedAt ?? 0;
  const duration = song.duration ?? song.audioInfo?.durationMs ?? 0;
  const identity = [song.id, uri, size, importedAt, duration, WAVEFORM_VERSION].join('|');
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
