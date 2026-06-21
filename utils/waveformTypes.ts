export const WAVEFORM_VERSION = 1;
export const DEFAULT_WAVEFORM_POINT_COUNT = 72;

export type WaveformSource = 'fallback' | 'native';

export interface SongWaveform {
  version: number;
  points: number[];
  durationMs: number;
  sourceKey: string;
  source: WaveformSource;
  generatedAt: number;
}

export interface NativeWaveformResult {
  points: number[];
  durationMs?: number;
}

export const isSongWaveform = (value: unknown): value is SongWaveform => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SongWaveform>;
  return candidate.version === WAVEFORM_VERSION
    && typeof candidate.sourceKey === 'string'
    && candidate.sourceKey.length > 0
    && typeof candidate.durationMs === 'number'
    && Number.isFinite(candidate.durationMs)
    && candidate.durationMs >= 0
    && (candidate.source === 'fallback' || candidate.source === 'native')
    && Array.isArray(candidate.points)
    && candidate.points.length > 0
    && candidate.points.every(point => typeof point === 'number' && Number.isFinite(point) && point >= 0 && point <= 1);
};
