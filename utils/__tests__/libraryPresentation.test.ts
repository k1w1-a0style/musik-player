import { cleanPersonLikeLabel, displayAlbum, displayArtist, displayFolderName, displayGenre, groupSongs, mergeSongs } from '../libraryPresentation';
import type { Song } from '../../types/Song';

jest.mock('../mediaLibraryImport', () => ({
  deriveFolderNameFromUri: (uri: string) => uri.includes('Music') ? 'Music' : '',
}));

jest.mock('../songArtwork', () => ({
  getSongArtworkUri: (song?: Song) => song?.cover,
}));

const song = (patch: Partial<Song>): Song => ({
  id: patch.id ?? 'id',
  title: patch.title ?? 'Title',
  artist: patch.artist ?? 'Artist',
  uri: patch.uri,
  album: patch.album,
  genre: patch.genre,
  cover: patch.cover,
});

test('cleans SAF/content labels to readable names', () => {
  expect(cleanPersonLikeLabel('primary:Music/Foo Artist.mp3')).toBe('Foo Artist');
  expect(cleanPersonLikeLabel('content://tree/Music/Bar Album.flac')).toBe('Bar Album');
  expect(cleanPersonLikeLabel('Real Artist')).toBe('Real Artist');
});

test('display helpers provide fallbacks', () => {
  expect(displayArtist(song({ artist: '' }))).toBe('Unbekannt');
  expect(displayAlbum(song({ album: undefined }))).toBe('Unbekanntes Album');
  expect(displayGenre(song({ genre: undefined }))).toBe('Unbekanntes Genre');
});

test('displayFolderName prefers derived folder name', () => {
  expect(displayFolderName({ id: 'f1', name: 'Fallback', uri: 'content://Music', addedAt: 1, enabled: true })).toBe('Music');
  expect(displayFolderName({ id: 'f2', name: 'Fallback', uri: 'content://Other', addedAt: 1, enabled: true })).toBe('Fallback');
});

test('displayFolderName falls back to generic folder label', () => {
  expect(displayFolderName({ id: 'f3', name: '', uri: 'content://Other', addedAt: 1, enabled: true })).toBe('Ordner');
});

test('mergeSongs dedupes by uri and keeps newest imported fields', () => {
  const merged = mergeSongs(
    [song({ id: 'old', title: 'Old', artist: 'A', uri: 'file:///same.mp3' })],
    [song({ id: 'new', title: 'New', artist: 'B', album: 'Album', uri: 'file:///same.mp3' })],
  );

  expect(merged).toHaveLength(1);
  expect(merged[0]).toMatchObject({ id: 'new', title: 'New', artist: 'B', album: 'Album' });
});

test('mergeSongs dedupes by id when uri is missing', () => {
  const merged = mergeSongs(
    [song({ id: 'same', title: 'Old', artist: 'A' })],
    [song({ id: 'same', title: 'New', artist: 'B', album: 'Album' })],
  );

  expect(merged).toEqual([song({ id: 'same', title: 'New', artist: 'B', album: 'Album' })]);
});

test('groupSongs groups and sorts with cover fallback', () => {
  const groups = groupSongs([
    song({ id: '2', title: 'Beta', artist: 'B', album: 'Z Album' }),
    song({ id: '1', title: 'Alpha', artist: 'A', album: 'A Album', cover: 'cover-a' }),
    song({ id: '3', title: 'Gamma', artist: 'C', album: 'A Album' }),
  ], 'album');

  expect(groups.map(group => group.title)).toEqual(['A Album', 'Z Album']);
  expect(groups[0].subtitle).toBe('2 Tracks');
  expect(groups[0].cover).toBe('cover-a');
  expect(groups[0].songs.map(item => item.title)).toEqual(['Alpha', 'Gamma']);
});

test('groupSongs uses singular subtitle for one track', () => {
  const groups = groupSongs([song({ id: '1', title: 'Alpha', artist: 'A', genre: 'Techno' })], 'genre');

  expect(groups[0].subtitle).toBe('1 Track');
});