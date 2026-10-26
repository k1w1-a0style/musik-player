import { isSongInActiveLibrary, reconcileSourceObservation } from '../librarySourceOwnership';
import { mergeSongs } from '../libraryPresentation';
import type { Song } from '../../types/Song';
const root = 'content://com.android.externalstorage.documents/tree/primary%3AMusic';
const uri = root + '/document/primary%3AMusic%2Fa.mp3';
const folder = { id: 'f', uri: root, name: 'Music', enabled: true, addedAt: 1 };
const song: Song = { id: 'stable', uri, title: 'A', artist: 'B', cover: 'cached', fileInfo: { source: 'saf' } };
test('explicit removal hides an owned track without deleting its record or playlist ID; readd restores it', () => {
  const playlist = ['stable'];
  expect(isSongInActiveLibrary(song, [folder])).toBe(true);
  expect(isSongInActiveLibrary(song, [{ ...folder, enabled: false, removed: true }])).toBe(false);
  expect(isSongInActiveLibrary(song, [{ ...folder, lastError: 'permission' }])).toBe(true);
  expect(isSongInActiveLibrary(song, [folder])).toBe(true);
  expect(song.id).toBe(playlist[0]); expect(song.cover).toBe('cached');
});
test('a remaining overlapping folder keeps the track active', () => {
  expect(isSongInActiveLibrary(song, [{ ...folder, enabled: false, removed: true },
    { ...folder, id: 'parent', uri: root.replace('Music', 'M') }])).toBe(false);
  expect(isSongInActiveLibrary(song, [{ ...folder, enabled: false, removed: true },
    { ...folder, id: 'duplicate' }])).toBe(true);
});
test('a confirmed MediaStore alias preserves the track after its SAF folder is removed', () => {
  const observed = reconcileSourceObservation([song], { source: 'media-library', uris: [uri], complete: true });
  expect(isSongInActiveLibrary(observed[0], [{ ...folder, enabled: false, removed: true }])).toBe(true);
  expect(isSongInActiveLibrary(observed[0], [{ ...folder, enabled: false, removed: true }], false)).toBe(false);
  expect(isSongInActiveLibrary(observed[0], [folder], false)).toBe(true);
  expect(observed[0].id).toBe('stable');
});
test('only a complete error-free listing can retire a missing source; unreadable providers preserve data', () => {
  const known = reconcileSourceObservation([song], { source: root, uris: [uri], complete: true });
  const failed = reconcileSourceObservation(known, { source: root, uris: [], complete: false });
  expect(isSongInActiveLibrary(failed[0], [folder])).toBe(true);
  const gone = reconcileSourceObservation(known, { source: root, uris: [], complete: true });
  expect(isSongInActiveLibrary(gone[0], [folder])).toBe(false);
  const restored = reconcileSourceObservation(gone, { source: root, uris: [uri], complete: true });
  expect(isSongInActiveLibrary(restored[0], [folder])).toBe(true);
  expect(mergeSongs(known, restored)).toHaveLength(1);
});

test('a renamed path retires only its confirmed old source and never matches another file by name', () => {
  const renamed = { ...song, id: 'new-path', uri: uri.replace('a.mp3', 'renamed.mp3') };
  const observed = reconcileSourceObservation([song, renamed], { source: root, uris: [renamed.uri], complete: true });
  expect(observed.filter(item => isSongInActiveLibrary(item, [folder])).map(item => item.id)).toEqual(['new-path']);
  expect(observed).toHaveLength(2); // Retain the old playlist reference, not a duplicate active row.
  expect(isSongInActiveLibrary({ ...song, uri: uri.replace('Music%2F', 'Other%2F') }, [{ ...folder, enabled: false, removed: true }])).toBe(true);
});
