import type { Song } from '../../types/Song';
import { LibraryWaveformPreloadIndex } from '../libraryWaveformPreloadIndex';
import * as generator from '../waveformGenerator';

const song = (id: string, importedAt = 1): Song => ({
  id, title: id, artist: 'CI', uri: `file:///${id}.mp3`, duration: 60000,
  fileInfo: { importedAt },
});

afterEach(() => jest.restoreAllMocks());

test('maintains a source revision without cancelling for metadata or order changes', () => {
  const index = new LibraryWaveformPreloadIndex(20 * 60 * 1000);
  const older = song('older', 1); const newer = song('newer', 2);
  const revision = index.update([older, newer]);
  expect(index.getCandidates().map(candidate => candidate.song.id)).toEqual(['newer', 'older']);
  expect(index.update([newer, { ...older, title: 'Edited', duration: 61000, cover: 'file:///cover.jpg' }])).toBe(revision);
  expect(index.getCandidates()[1].song.duration).toBe(61000);
  expect(index.update([{ ...newer, uri: 'file:///changed.mp3' }, older])).toBe(revision + 1);
  expect(index.update([older])).toBe(revision + 2);
});

test('only hashes a new physical source and leaves unchanged candidate ordering intact', () => {
  const fingerprint = jest.spyOn(generator, 'createWaveformSourceIdentity');
  const index = new LibraryWaveformPreloadIndex(20 * 60 * 1000);
  const library = Array.from({ length: 2000 }, (_, id) => song(String(id), id));
  index.update(library);
  const candidates = index.getCandidates();
  expect(fingerprint).toHaveBeenCalledTimes(2000);
  fingerprint.mockClear();
  index.update(library);
  const edited = library.slice(); edited[0] = { ...library[0], title: 'Changed metadata' };
  index.update(edited);
  expect(fingerprint).not.toHaveBeenCalled();
  expect(index.getCandidates()).toBe(candidates);
  edited[0] = { ...edited[0], uri: 'file:///replacement.mp3' };
  index.update([...edited]);
  expect(fingerprint).toHaveBeenCalledTimes(1);
});

test('attempted tracks are not rescanned but a replacement is eligible', () => {
  const index = new LibraryWaveformPreloadIndex(20 * 60 * 1000); const selected = song('selected');
  index.update([selected]);
  const fingerprint = index.getCandidates()[0].sourceFingerprint;
  index.markAttempted(fingerprint);
  expect(index.getCandidates()).toEqual([]);
  index.update([{ ...selected, title: 'Edited metadata' }]);
  expect(index.getCandidates()).toEqual([]);
  index.update([{ ...selected, fileInfo: { size: 1, importedAt: 1 } }]);
  expect(index.getCandidates()).toHaveLength(1);
  index.markAttempted(fingerprint);
  expect(index.getCandidates()).toHaveLength(1);
});

test('discovers a duration without changing the source revision or repeating terminal failures', () => {
  const index = new LibraryWaveformPreloadIndex(20 * 60 * 1000); const selected = song('selected');
  const revision = index.update([{ ...selected, duration: undefined }]);
  expect(index.getCandidates()).toEqual([]);
  expect(index.update([selected])).toBe(revision);
  expect(index.getCandidates()).toHaveLength(1);
  index.markAttempted(index.getCandidates()[0].sourceFingerprint);
  index.update([{ ...selected, duration: 61000 }]);
  expect(index.getCandidates()).toEqual([]);
});

test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1200001])('skips an ineligible duration of %s', duration => {
  const index = new LibraryWaveformPreloadIndex(20 * 60 * 1000);
  index.update([{ ...song('selected'), duration }]);
  expect(index.getCandidates()).toEqual([]);
});

test('drops removed candidates and never prepares an absent URI', () => {
  const index = new LibraryWaveformPreloadIndex(20 * 60 * 1000);
  const selected = song('selected');
  index.update([selected, { ...song('absent'), uri: undefined }]);
  expect(index.getCandidates()).toHaveLength(1);
  index.update([]);
  expect(index.getCandidates()).toEqual([]);
});

test.each(['modificationTime', 'contentHash'] as const)('dirty-tracks a physical %s revision even after the old same-size source was attempted', field => {
  const index = new LibraryWaveformPreloadIndex(20 * 60 * 1000);
  const original: Song = { ...song('selected'), fileInfo: { size: 4096, importedAt: 1, modificationTime: 100, contentHash: 'old-content' } };
  const revision = index.update([original]);
  index.markAttempted(index.getCandidates()[0].sourceFingerprint);
  expect(index.getCandidates()).toEqual([]);
  const changed: Song = { ...original, fileInfo: { ...original.fileInfo,
    ...(field === 'modificationTime' ? { modificationTime: 101 } : { contentHash: 'changed-content' }),
  } };
  expect(index.update([changed])).toBe(revision + 1);
  expect(index.getCandidates()).toHaveLength(1);
});
