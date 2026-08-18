export const WAVEFORM_VERSION = 4;
export const DEFAULT_WAVEFORM_POINT_COUNT = 72;
export const WAVEFORM_FINGERPRINT_PREFIX = `wf${WAVEFORM_VERSION}:`;

export type WaveformSource = 'fallback' | 'native';

export interface WaveformSourceIdentity {
  sourceKey: string;
  sourceFingerprint: string;
}

export interface SongWaveform extends WaveformSourceIdentity {
  version: number;
  points: number[];
  durationMs: number;
  source: WaveformSource;
  generatedAt: number;
}

export interface NativeWaveformResult {
  points: number[];
  durationMs?: number;
  analysis?: 'decoded-pcm-v1';
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

export const isSongWaveform = (value: unknown): value is SongWaveform => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SongWaveform>;
  return candidate.version === WAVEFORM_VERSION
    && isWaveformSourceIdentity(value)
    && typeof candidate.durationMs === 'number'
    && Number.isFinite(candidate.durationMs)
    && candidate.durationMs >= 0
    && (candidate.source === 'fallback' || candidate.source === 'native')
    && Array.isArray(candidate.points)
    && candidate.points.length > 0
    && candidate.points.every((point: number) => Number.isFinite(point) && point >= 0 && point <= 1);
};
