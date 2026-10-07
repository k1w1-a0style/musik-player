import {
  buildFallbackWaveform,
  buildNativeWaveform,
  createWaveformSourceIdentity,
  getWaveformCanonicalIdentity,
  getWaveformSourceIdentity,
  normalizeWaveformPoints,
} from '../waveformGenerator';

const song = {
  id: 's1',
  title: 'Song',
  artist: 'Artist',
  uri: 'file:///music/song.mp3',
  duration: 123000,
};

test('builds a flat fallback without invented peaks and full source identity', () => {
  const first = buildFallbackWaveform(song, 123000, 16);
  const second = buildFallbackWaveform(song, 123000, 16);
  const identity = getWaveformSourceIdentity(song);

  expect(first.source).toBe('fallback');
  expect(first.sourceKey).toBe(identity.sourceKey);
  expect(first).toMatchObject(identity);
  expect(first.sourceFingerprint).toMatch(/^wf6:[0-9a-f]{32}$/);
  expect(first.points).toHaveLength(16);
  expect(first.points).toEqual(second.points);
  expect(first.points).toEqual(Array(16).fill(0));
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

test('empty waveform data stays flat', () => {
  expect(normalizeWaveformPoints([], 16)).toEqual(Array(16).fill(0));
});

test('duration and metadata backfill preserve the physical source identity', () => {
  const original = getWaveformSourceIdentity({ ...song, duration: undefined });
  expect(getWaveformSourceIdentity(song)).toEqual(original);
  expect(getWaveformSourceIdentity({ ...song, duration: 124000, audioInfo: { durationMs: 125000 }, title: 'New title' })).toEqual(original);
});

test.each([
  { ...song, uri: 'file:///different.mp3' },
  { ...song, fileInfo: { size: 8192 } },
  { ...song, fileInfo: { importedAt: 43 } },
])('physical source changes invalidate identity: %j', changed => {
  expect(getWaveformSourceIdentity(changed)).not.toEqual(getWaveformSourceIdentity(song));
});

test('retains the exact v6 canonical layout when no physical revision is known', () => {
  expect(getWaveformCanonicalIdentity(song)).toBe('1:6|2:s1|22:file:///music/song.mp3|1:0|1:0|1:0');
  expect(getWaveformSourceIdentity({ ...song, fileInfo: { modificationTime: Number.NaN, contentHash: ' ' } }))
    .toEqual(getWaveformSourceIdentity(song));
});

test.each([
  { modificationTime: 100 }, { contentHash: 'old-content' },
])('changing physical revision invalidates a same-URI, same-size source: %j', revision => {
  const original = { ...song, fileInfo: { size: 4096, importedAt: 42, ...revision } };
  const changed = { ...original, fileInfo: { ...original.fileInfo,
    ...(revision.modificationTime ? { modificationTime: 101 } : { contentHash: 'changed-content' }),
  } };
  expect(getWaveformSourceIdentity(changed)).not.toEqual(getWaveformSourceIdentity(original));
  expect(getWaveformSourceIdentity({ ...original, title: 'Edited title', artist: 'Edited artist', duration: 1,
    audioInfo: { durationMs: 2 }, cover: 'file:///new-cover.jpg' })).toEqual(getWaveformSourceIdentity(original));
});
