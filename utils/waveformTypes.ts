export const WAVEFORM_VERSION = 6;
export const WAVEFORM_CACHE_POINT_COUNT = 1024;
export const DEFAULT_WAVEFORM_POINT_COUNT = WAVEFORM_CACHE_POINT_COUNT;
export const WAVEFORM_FINGERPRINT_PREFIX = `wf${WAVEFORM_VERSION}:`;

export type WaveformSource = 'fallback' | 'native';

export interface WaveformSourceIdentity {
  sourceKey: string;
  sourceFingerprint: string;
}

export interface SongWaveform extends WaveformSourceIdentity {
  version: number;
  points: number[];
  /** Decoded bass energy (35–160 Hz), uniformly spaced over durationMs. */
  bassPoints?: number[];
  durationMs: number;
  source: WaveformSource;
  generatedAt: number;
}

export interface NativeWaveformResult {
  points: number[];
  /** Decoded bass energy (35–160 Hz), uniformly spaced over durationMs. */
  bassPoints?: number[];
  durationMs?: number;
  analysis?: 'decoded-pcm-v1';
  analysisDurationMs?: number;
}

export const isWaveformSourceIdentity = (value: unknown): value is WaveformSourceIdentity => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<WaveformSourceIdentity>;
  return typeof candidate.sourceKey === 'string'
    && candidate.sourceKey.length > 0
    && typeof candidate.sourceFingerprint === 'string'
    && candidate.sourceFingerprint.startsWith(WAVEFORM_FINGERPRINT_PREFIX)
    && /^[0-9a-f]{32}$/.test(candidate.sourceFingerprint.slice(WAVEFORM_FINGERPRINT_PREFIX.length));
};

const isNormalizedPointArray = (value: unknown, limit: number): value is number[] =>
  Array.isArray(value) && value.length > 0 && value.length <= limit
    && value.every(point => typeof point === 'number' && Number.isFinite(point) && point >= 0 && point <= 1);
const isNonNegativeFinite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

export const isSongWaveform = (value: unknown): value is SongWaveform => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SongWaveform>;
  return candidate.version === WAVEFORM_VERSION
    && isWaveformSourceIdentity(value)
    && isNonNegativeFinite(candidate.durationMs)
    && (candidate.source === 'fallback' || candidate.source === 'native')
    && isNormalizedPointArray(candidate.points, WAVEFORM_CACHE_POINT_COUNT)
    && (candidate.bassPoints === undefined || isNormalizedPointArray(candidate.bassPoints, 24_000))
    && isNonNegativeFinite(candidate.generatedAt);
};
