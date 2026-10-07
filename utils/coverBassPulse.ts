import type { SongWaveform } from './waveformTypes';

export const MAX_COVER_BASS_SCALE = 1.08;
export const BASS_PULSE_STEP_MS = 50;
export const MAX_BASS_CURVE_POINTS = 96;

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
  // Ordinary mastered music contains much less bass energy than a pure bass
  // tone. Make those real beats visible without amplifying silence/treble
  // residue or exceeding the cover's safe bounds.
  return 1 + (MAX_COVER_BASS_SCALE - 1) * Math.sqrt(bass);
};

/** Bounded local UI graph; stored/native analysis keeps every 50 ms bass bucket. */
export const buildCoverBassCurve = (
  points: readonly number[], durationMs: number, startMs: number, endMs: number,
): { inputRange: number[]; outputRange: number[] } => {
  if (!points.length || !Number.isFinite(durationMs) || durationMs <= 0)
    return { inputRange: [0, 1], outputRange: [0, 0] };
  const start = Math.max(0, Math.min(durationMs, Number.isFinite(startMs) ? startMs : 0));
  const end = Math.max(start + 0.001, Math.min(durationMs, Number.isFinite(endMs) ? endMs : durationMs));
  const step = durationMs / points.length;
  const first = Math.floor(start / step);
  const last = Math.min(points.length - 1, Math.ceil(end / step));
  const indexes: number[] = [];
  // Ordinary 50 ms buckets fit without reduction in the active clock window.
  // Unusually dense/short envelopes retain each bin's trough and peak rather
  // than averaging away narrow kick transients.
  const bucketSize = Math.max(1, Math.ceil((last - first + 1) / ((MAX_BASS_CURVE_POINTS - 2) / 2)));
  for (let offset = first; offset <= last; offset += bucketSize) {
    let min = offset; let max = offset;
    for (let index = offset + 1; index <= Math.min(last, offset + bucketSize - 1); index += 1) {
      if (points[index] < points[min]) min = index;
      if (points[index] > points[max]) max = index;
    }
    indexes.push(...(min === max ? [min] : [Math.min(min, max), Math.max(min, max)]));
  }
  const inputRange = [start];
  const outputRange = [getCoverBassScale(points, durationMs, start) - 1];
  for (const index of indexes) {
    const position = index * step;
    if (position <= start || position >= end) continue;
    inputRange.push(position);
    outputRange.push(getCoverBassScale(points, durationMs, (index + 0.5) * step) - 1);
  }
  inputRange.push(end);
  outputRange.push(getCoverBassScale(points, durationMs, end) - 1);
  return { inputRange, outputRange };
};
