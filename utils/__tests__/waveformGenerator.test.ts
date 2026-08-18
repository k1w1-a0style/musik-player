import {
  buildFallbackWaveform,
  buildNativeWaveform,
  createWaveformSourceIdentity,
  getWaveformCanonicalIdentity,
  getWaveformSourceIdentity,
  getWaveformSourceKey,
  normalizeWaveformPoints,
} from '../waveformGenerator';

const song = {
  id: 's1',
  title: 'Song',
  artist: 'Artist',
  uri: 'file:///music/song.mp3',
  duration: 123000,
};

test('builds deterministic fallback waveform points and full source identity', () => {
  const first = buildFallbackWaveform(song, 123000, 16);
  const second = buildFallbackWaveform(song, 123000, 16);
  const identity = getWaveformSourceIdentity(song);

  expect(first.source).toBe('fallback');
  expect(first.sourceKey).toBe(getWaveformSourceKey(song));
  expect(first).toMatchObject(identity);
  expect(first.sourceFingerprint).toMatch(/^wf4:[0-9a-f]{32}$/);
  expect(first.points).toHaveLength(16);
  expect(first.points).toEqual(second.points);
  expect(first.points.every(point => point >= 0 && point <= 1)).toBe(true);
});

test('length-prefixes canonical identity fields to avoid delimiter ambiguity', () => {
  const first = getWaveformCanonicalIdentity({ ...song, id: 'a|b', uri: 'file:///c.mp3' });
  const second = getWaveformCanonicalIdentity({ ...song, id: 'a', uri: 'b|file:///c.mp3' });
  expect(first).not.toBe(second);
});

test('keeps colliding primary keys fail-closed with independent fingerprints', () => {
  const forcedCollision = () => 42;
  const first = createWaveformSourceIdentity('first-source', forcedCollision);
  const second = createWaveformSourceIdentity('second-source', forcedCollision);

  expect(first.sourceKey).toBe(second.sourceKey);
  expect(first.sourceFingerprint).not.toBe(second.sourceFingerprint);
});

test('normalizes native waveform points to target count', () => {
  expect(normalizeWaveformPoints([0, 0.5, 2, Number.NaN], 8)).toHaveLength(8);
  expect(normalizeWaveformPoints([0.1, 0.9], 8).every(point => point >= 0 && point <= 1)).toBe(true);
});

test('builds native waveform with normalized points and full source identity', () => {
  const waveform = buildNativeWaveform(song, { points: [0.2, 0.9, 1.4], durationMs: 123000 }, 1000, 12);

  expect(waveform.source).toBe('native');
  expect(waveform).toMatchObject(getWaveformSourceIdentity(song));
  expect(waveform.points).toHaveLength(12);
  expect(waveform.durationMs).toBe(123000);
});
