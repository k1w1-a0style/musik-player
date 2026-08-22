import type { Song } from '../types/Song';
import {
  DEFAULT_WAVEFORM_POINT_COUNT,
  WAVEFORM_FINGERPRINT_PREFIX,
  WAVEFORM_VERSION,
  type NativeWaveformResult,
  type SongWaveform,
  type WaveformSourceIdentity,
} from './waveformTypes';

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const FINGERPRINT_SEEDS = [0x9747b28c, 0x85ebca6b, 0xc2b2ae35, 0x27d4eb2f] as const;

export const hashWaveformIdentity = (value: string): number => {
  let hash = FNV_OFFSET;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash;
};

const hashWaveformFingerprintPart = (value: string, seed: number): number => {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x5bd1e995) >>> 0;
    hash ^= hash >>> 13;
  }
  hash = Math.imul(hash ^ (hash >>> 15), 0x85ebca6b) >>> 0;
  return (hash ^ (hash >>> 16)) >>> 0;
};

const buildWaveformFingerprint = (value: string): string => `${WAVEFORM_FINGERPRINT_PREFIX}${FINGERPRINT_SEEDS
  .map(seed => hashWaveformFingerprintPart(value, seed).toString(16).padStart(8, '0'))
  .join('')}`;

const encodeIdentityPart = (value: string | number): string => {
  const encoded = String(value);
  return `${encoded.length}:${encoded}`;
};

export const getWaveformCanonicalIdentity = (song: Song | null | undefined): string => {
  if (!song) return [WAVEFORM_VERSION, 'no-song'].map(encodeIdentityPart).join('|');
  const uri = song.fileInfo?.uri ?? song.uri ?? '';
  const size = song.fileInfo?.size ?? 0;
  const importedAt = song.fileInfo?.importedAt ?? 0;
  const duration = song.duration ?? song.audioInfo?.durationMs ?? 0;
  return [WAVEFORM_VERSION, song.id, uri, size, importedAt, duration].map(encodeIdentityPart).join('|');
};

export const createWaveformSourceIdentity = (
  canonicalIdentity: string,
  primaryHash: (value: string) => number = hashWaveformIdentity,
): WaveformSourceIdentity => ({
  sourceKey: (primaryHash(canonicalIdentity) >>> 0).toString(36),
  sourceFingerprint: buildWaveformFingerprint(canonicalIdentity),
});

export const getWaveformSourceIdentity = (song: Song | null | undefined): WaveformSourceIdentity =>
  createWaveformSourceIdentity(getWaveformCanonicalIdentity(song));

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

export const buildFallbackWaveform = (
  song: Song | null | undefined,
  durationMs: number,
  pointCount = DEFAULT_WAVEFORM_POINT_COUNT,
): SongWaveform => {
  const sourceIdentity = getWaveformSourceIdentity(song);
  return {
    version: WAVEFORM_VERSION,
    points: buildSyntheticPoints(sourceIdentity.sourceFingerprint, pointCount),
    durationMs: Number.isFinite(durationMs) && durationMs > 0 ? durationMs : song?.duration ?? song?.audioInfo?.durationMs ?? 0,
    ...sourceIdentity,
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
  ...getWaveformSourceIdentity(song),
  source: 'native',
  generatedAt: Date.now(),
});
