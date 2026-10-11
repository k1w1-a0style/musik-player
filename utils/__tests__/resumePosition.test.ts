import type { Song } from '../../types/Song';
import { findResumeEntry, getResumeSource, isUsefulResumePosition, parseResumePositions, pruneResumeEntries,
  RESUME_MAX_AGE_MS, RESUME_MAX_CODE_UNITS, serializeResumePositions, type ResumeEntry } from '../resumePosition';
const now = 1800000000000;
const song: Song = { id: 'mix', title: 'Mix', artist: 'Artist', duration: 3600000, uri: 'file:///Music/Case.mp3',
  fileInfo: { size: 1000, modificationTime: 1700000000000 } };
const entry: ResumeEntry = { songId: song.id, source: getResumeSource(song)!, positionMs: 120000,
  durationMs: 3600000, updatedAt: now };
test('resume source requires real revision proof and preserves source case', () => {
  expect(getResumeSource({ id: 'a', title: 'Mix', artist: 'Artist', uri: song.uri })).toBeNull();
  expect(getResumeSource(song)).not.toBe(getResumeSource({ ...song, uri: 'file:///Music/case.mp3' }));
  expect(getResumeSource({ ...song, fileInfo: { ...song.fileInfo, modificationTime: 1800000000000 } })).not.toBe(entry.source);
});
test('a complete hash is revision proof without trusting display text or derived duration', () => {
  const hashed = { ...song, fileInfo: { contentHash: 'a'.repeat(64) } };
  expect(getResumeSource(hashed)).toBeTruthy();
  expect(getResumeSource({ ...hashed, title: 'New title', duration: 0 })).toBe(getResumeSource(hashed));
  expect(getResumeSource({ ...hashed, fileInfo: { contentHash: 'b'.repeat(64) } })).not.toBe(getResumeSource(hashed));
});
test.each([[10000, 3600000, false], [120000, 600000, false], [3580000, 3600000, false],
  [120000, 1200000, true], [Infinity, 1200000, false], [120000, NaN, false]])('position %s in duration %s is useful: %s', (position, duration, expected) => {
  expect(isUsefulResumePosition(position, duration)).toBe(expected);
});
test('old, future, near-end and duplicate entries are bounded to the newest valid receipt', () => {
  const entries = pruneResumeEntries([entry, { ...entry, positionMs: 150000, updatedAt: now + 1 },
    { ...entry, source: 'old', updatedAt: now - RESUME_MAX_AGE_MS - 1 },
    { ...entry, source: 'future', updatedAt: now + 60001 }, { ...entry, source: 'end', positionMs: 3595000 }], now);
  expect(entries).toEqual([{ ...entry, positionMs: 150000, updatedAt: now + 1 }]);
});
test('a changed physical file, short new duration or large duration discrepancy never receives an old position', () => {
  expect(findResumeEntry(song, [entry], now)).toEqual(entry);
  expect(findResumeEntry({ ...song, fileInfo: { ...song.fileInfo, size: 999 } }, [entry], now)).toBeUndefined();
  expect(findResumeEntry({ ...song, duration: 600000 }, [entry], now)).toBeUndefined();
  expect(findResumeEntry({ ...song, duration: 3700000 }, [entry], now)).toBeUndefined();
});
test('serialization is versioned and oversized input fails before JSON parsing', () => {
  expect(parseResumePositions(serializeResumePositions([entry]), now)).toEqual([entry]);
  const parse = jest.spyOn(JSON, 'parse');
  expect(() => parseResumePositions(' '.repeat(RESUME_MAX_CODE_UNITS + 1), now)).toThrow('budget');
  expect(parse).not.toHaveBeenCalled(); parse.mockRestore();
  expect(() => parseResumePositions('{')).toThrow();
});
