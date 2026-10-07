import { buildCoverBassCurve, getCoverBassScale, hasBassEnvelope, MAX_BASS_CURVE_POINTS, MAX_COVER_BASS_SCALE } from '../coverBassPulse';
import { buildNativeWaveform } from '../waveformGenerator';

test('ordinary bass energy produces a visible pulse rather than a subpixel change', () => {
  expect(getCoverBassScale([0.35], 1000, 100)).toBeGreaterThanOrEqual(1.03);
  expect(getCoverBassScale([0.03], 1000, 100)).toBe(1);
});

test('only decoded bass peaks enlarge the cover, at the corresponding playback time', () => {
  expect(getCoverBassScale([0, 1, 0, 0.5], 2000, 100)).toBe(1);
  expect(getCoverBassScale([0, 1, 0, 0.5], 2000, 600)).toBeCloseTo(MAX_COVER_BASS_SCALE);
  expect(getCoverBassScale([0, 1, 0, 0.5], 2000, 1100)).toBe(1);
  expect(getCoverBassScale([0, 1, 0, 0.5], 2000, 1600)).toBeGreaterThan(1);
});

test('silence, invalid data and time beyond the end cannot pulse', () => {
  for (const time of [-1, NaN, Infinity, 1000]) expect(getCoverBassScale([1], 1000, time)).toBe(1);
  expect(getCoverBassScale([0.02], 1000, 0)).toBe(1);
  expect(getCoverBassScale([NaN], 1000, 0)).toBe(1);
  expect(getCoverBassScale([], 1000, 0)).toBe(1);
});

test('new decoded bass data survives waveform construction; invalid data is discarded', () => {
  const result = { points: Array(16).fill(0.5), bassPoints: [0, 0.5, 1], durationMs: 3000 };
  const waveform = buildNativeWaveform({ id: 'one', title: 'One', artist: 'Artist' }, result, 3000);
  expect(hasBassEnvelope(waveform)).toBe(true);
  expect(waveform.bassPoints).toEqual([0, 0.5, 1]);
  expect(hasBassEnvelope({ ...waveform, bassPoints: [NaN] })).toBe(false);
  expect(buildNativeWaveform(null, { ...result, bassPoints: [Infinity] }, 3000).bassPoints).toBeUndefined();
});

test('a long envelope uses a small active window while retaining every 50 ms kick', () => {
  const points = Array<number>(24_000).fill(0);
  points[10_000] = 1; points[10_003] = 0.7;
  const original = [...points];
  const curve = buildCoverBassCurve(points, 1_200_000, 499750, 501000);
  expect(curve.inputRange.length).toBeLessThanOrEqual(MAX_BASS_CURVE_POINTS);
  const kick = curve.inputRange.indexOf(500000);
  expect(kick).toBeGreaterThan(0);
  expect(curve.outputRange[kick]).toBeCloseTo(MAX_COVER_BASS_SCALE - 1);
  expect(curve.inputRange).toContain(500150);
  expect(points).toEqual(original);
  expect(curve.inputRange.every((value, index) => !index || value > curve.inputRange[index - 1])).toBe(true);
});

test('dense envelopes preserve troughs and maxima under the graph bound instead of averaging kicks away', () => {
  const points = Array<number>(24_000).fill(0.01);
  points[12_000] = 1;
  const curve = buildCoverBassCurve(points, 1000, 0, 1000);
  expect(curve.inputRange.length).toBeLessThanOrEqual(MAX_BASS_CURVE_POINTS);
  expect(Math.max(...curve.outputRange)).toBeCloseTo(MAX_COVER_BASS_SCALE - 1);
  expect(curve.outputRange).toContain(0);
  expect(buildCoverBassCurve([], 1000, 0, 1000)).toEqual({ inputRange: [0, 1], outputRange: [0, 0] });
  expect(buildCoverBassCurve([1], NaN, 0, 1000).outputRange).toEqual([0, 0]);
  expect(buildCoverBassCurve([1], 1000, NaN, NaN).inputRange.every(Number.isFinite)).toBe(true);
});
