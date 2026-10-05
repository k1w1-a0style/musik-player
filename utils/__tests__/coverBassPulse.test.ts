import { getCoverBassScale, hasBassEnvelope, MAX_COVER_BASS_SCALE } from '../coverBassPulse';
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
