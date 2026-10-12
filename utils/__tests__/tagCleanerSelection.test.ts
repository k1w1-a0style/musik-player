import { resolveCleanerFolderSelection, uniqueCleanerSongs } from '../tagCleanerSelection';
import type { Song } from '../../types/Song';
const song = (id: string, uri: string): Song => ({ id, uri, title: id, artist: 'A' });
const folder = (id: string, uri: string) => ({ id, uri, name: id, addedAt: 0, enabled: true });
test('deduplicates canonical document identities, never filenames', () => {
  expect(uniqueCleanerSongs([song('a', 'content://p/tree/x/document/A%3Ax'), song('b', 'content://p/document/A%3Ax'), song('c', 'file:///A/x')]).map(s => s.id)).toEqual(['a', 'c']);
});
test('matches exact volume and path segments, optional recursion, with per-folder counts', () => {
  const songs = [song('a', 'content://com.android.externalstorage.documents/document/primary%3AMusic%2FA%2Fx.mp3'), song('b', 'content://com.android.externalstorage.documents/document/primary%3AMusic%2FAA%2Fx.mp3'), song('c', 'content://com.android.externalstorage.documents/document/primary%3AMusic%2FA%2Fsub%2Fy.mp3')];
  const folders = [folder('A', 'content://com.android.externalstorage.documents/tree/primary%3AMusic%2FA')];
  expect(resolveCleanerFolderSelection(songs, folders, false)).toEqual({songIds: ['a'], countsByFolder: {A: 1}, unresolvedFolderIds: []});
  expect(resolveCleanerFolderSelection(songs, folders, true).songIds).toEqual(['a', 'c']);
});
test('fails closed for opaque and MediaStore folders and preserves exact case', () => {
  const songs = [song('a', 'file:///Music/A/x.mp3'), song('b', 'file:///Music/a/y.mp3')];
  expect(resolveCleanerFolderSelection(songs, [folder('A', 'file:///Music/A'), folder('opaque', 'content://p/tree/123')], true)).toEqual({songIds: ['a'], countsByFolder: {A: 1, opaque: 0}, unresolvedFolderIds: ['opaque']});
});
