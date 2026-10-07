import type { Song } from '../types/Song';
import {
  DEFAULT_WAVEFORM_POINT_COUNT,
  WAVEFORM_CACHE_POINT_COUNT,
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

export const WAVEFORM_PHYSICAL_REVISION_FORMAT = 'physical-v1';
const physicalRevisionParts = (song: Song | null | undefined): (string | number)[] => {
  const reportedTime = song?.fileInfo?.modificationTime;
  const modificationTime = typeof reportedTime === 'number' && Number.isFinite(reportedTime) && reportedTime > 0 ? reportedTime : 0;
  const contentHash = song?.fileInfo?.contentHash?.trim() ?? '';
  return modificationTime || contentHash ? [WAVEFORM_PHYSICAL_REVISION_FORMAT, modificationTime, contentHash] : [];
};

const buildCanonicalIdentity = (song: Song | null | undefined, duration: number): string => {
  if (!song) return [WAVEFORM_VERSION, 'no-song'].map(encodeIdentityPart).join('|');
  const uri = song.fileInfo?.uri ?? song.uri ?? '';
  const size = song.fileInfo?.size ?? 0;
  const importedAt = song.fileInfo?.importedAt ?? 0;
  return [WAVEFORM_VERSION, song.id, uri, size, importedAt, duration, ...physicalRevisionParts(song)]
    .map(encodeIdentityPart).join('|');
};

// Duration is derived metadata: discovering it must not cancel decoding or
// invalidate a finalized shape. Keep the v6 zero-duration layout so existing
// unknown-duration cache entries remain directly reusable when no physical
// revision is known. A known provider date/content hash adds a versioned suffix;
// every compatibility key keeps it, so an unrevisioned older shape is never selected.
export const getWaveformCanonicalIdentity = (song: Song | null | undefined): string =>
  buildCanonicalIdentity(song, 0);

export const createWaveformSourceIdentity = (
  canonicalIdentity: string,
  primaryHash: (value: string) => number = hashWaveformIdentity,
): WaveformSourceIdentity => ({
  sourceKey: (primaryHash(canonicalIdentity) >>> 0).toString(36),
  sourceFingerprint: buildWaveformFingerprint(canonicalIdentity),
});

export const getWaveformSourceIdentity = (song: Song | null | undefined): WaveformSourceIdentity =>
  createWaveformSourceIdentity(getWaveformCanonicalIdentity(song));

/** Exact duration-layout variants only; physical revision is preserved in every candidate. */
export const getCompatibleWaveformSourceIdentities = (song: Song | null | undefined): WaveformSourceIdentity[] => {
  const durations = new Set([0, song?.duration ?? 0, song?.audioInfo?.durationMs ?? 0]);
  return [...durations].filter(duration => Number.isFinite(duration) && duration >= 0)
    .map(duration => createWaveformSourceIdentity(buildCanonicalIdentity(song, duration)));
};

export const clampWaveformPoint = (value: number): number => {
  if (!Number.isFinite(value)) return 0.08;
  return Math.max(0.04, Math.min(1, value));
};

export const normalizeWaveformPoints = (points: readonly number[], targetCount = DEFAULT_WAVEFORM_POINT_COUNT): number[] => {
  const safeTarget = Math.max(8, Math.min(WAVEFORM_CACHE_POINT_COUNT, Math.floor(targetCount)));
  const safePoints = points.map(clampWaveformPoint);
  if (safePoints.length === 0) return Array(safeTarget).fill(0);
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

export const buildFallbackWaveform = (
  song: Song | null | undefined,
  durationMs: number,
  pointCount = DEFAULT_WAVEFORM_POINT_COUNT,
): SongWaveform => {
  const sourceIdentity = getWaveformSourceIdentity(song);
  return {
    version: WAVEFORM_VERSION,
    points: Array.from({ length: pointCount }, () => 0),
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
  points: normalizeWaveformPoints(result.points, pointCount).map(point => Math.round(point * 1000) / 1000),
  ...(Array.isArray(result.bassPoints) && result.bassPoints.length > 0 && result.bassPoints.length <= 24_000
    && result.bassPoints.every(point => Number.isFinite(point) && point >= 0 && point <= 1)
    ? { bassPoints: result.bassPoints.map(point => Math.round(point * 1000) / 1000) } : {}),
  durationMs: Number.isFinite(result.durationMs) && (result.durationMs ?? 0) > 0 ? result.durationMs as number : fallbackDurationMs,
  ...getWaveformSourceIdentity(song),
  source: 'native',
  generatedAt: Date.now(),
});
