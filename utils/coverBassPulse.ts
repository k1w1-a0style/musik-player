import type { SongWaveform } from './waveformTypes';

export const MAX_COVER_BASS_SCALE = 1.055;
export const BASS_PULSE_STEP_MS = 50;

export const hasBassEnvelope = (waveform: SongWaveform | null | undefined): waveform is SongWaveform & { bassPoints: number[] } =>
  Boolean(waveform && waveform.durationMs > 0 && Array.isArray(waveform.bassPoints)
    && waveform.bassPoints.length > 0 && waveform.bassPoints.length <= 24_000
    && waveform.bassPoints.every(point => Number.isFinite(point) && point >= 0 && point <= 1));

export const getCoverBassScale = (points: readonly number[], durationMs: number, positionMs: number): number => {
  if (!points.length || !Number.isFinite(durationMs) || durationMs <= 0
    || !Number.isFinite(positionMs) || positionMs < 0 || positionMs >= durationMs) return 1;
  const index = Math.min(points.length - 1, Math.floor(positionMs / durationMs * points.length));
  const energy = points[index];
  if (!Number.isFinite(energy) || energy <= 0.08) return 1;
  const bass = Math.max(0, Math.min(1, (energy - 0.08) / 0.92));
  return 1 + (MAX_COVER_BASS_SCALE - 1) * bass * bass;
};
