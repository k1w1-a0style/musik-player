import { buildFallbackWaveform, buildNativeWaveform, getWaveformSourceKey, normalizeWaveformPoints } from '../waveformGenerator';

const song = {
  id: 's1',
  title: 'Song',
  artist: 'Artist',
  uri: 'file:///music/song.mp3',
  duration: 123000,
};

test('builds deterministic fallback waveform points', () => {
  const first = buildFallbackWaveform(song, 123000, 16);
  const second = buildFallbackWaveform(song, 123000, 16);

  expect(first.source).toBe('fallback');
  expect(first.sourceKey).toBe(getWaveformSourceKey(song));
  expect(first.points).toHaveLength(16);
  expect(first.points).toEqual(second.points);
  expect(first.points.every(point => point >= 0 && point <= 1)).toBe(true);
});

test('normalizes native waveform points to target count', () => {
  expect(normalizeWaveformPoints([0, 0.5, 2, Number.NaN], 8)).toHaveLength(8);
  expect(normalizeWaveformPoints([0.1, 0.9], 8).every(point => point >= 0 && point <= 1)).toBe(true);
});

test('builds native waveform with normalized points and source key', () => {
  const waveform = buildNativeWaveform(song, { points: [0.2, 0.9, 1.4], durationMs: 123000 }, 1000, 12);

  expect(waveform.source).toBe('native');
  expect(waveform.sourceKey).toBe(getWaveformSourceKey(song));
  expect(waveform.points).toHaveLength(12);
  expect(waveform.durationMs).toBe(123000);
});
