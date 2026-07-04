import { filterFavoriteSongs, filterLibrarySongs } from '../librarySongs';
import type { Song } from '../../types/Song';

const song = (patch: Partial<Song>): Song => ({
  id: patch.id ?? 's1',
  title: patch.title ?? 'Title',
  artist: patch.artist ?? 'Artist',
  album: patch.album,
  genre: patch.genre,
  uri: patch.uri,
  fileInfo: patch.fileInfo,
});

test('filterLibrarySongs returns all songs for empty query', () => {
  const songs = [song({ id: 'a' }), song({ id: 'b' })];

  expect(filterLibrarySongs(songs, '   ')).toBe(songs);
});

test('filterLibrarySongs searches title artist album and genre', () => {
  const songs = [
    song({ id: 'kick', title: 'Hard Kick', artist: 'DJ One', album: 'Warehouse', genre: 'Techno' }),
    song({ id: 'soft', title: 'Soft Song', artist: 'Singer', album: 'Home', genre: 'Pop' }),
  ];

  expect(filterLibrarySongs(songs, 'kick').map(item => item.id)).toEqual(['kick']);
  expect(filterLibrarySongs(songs, 'dj one').map(item => item.id)).toEqual(['kick']);
  expect(filterLibrarySongs(songs, 'warehouse').map(item => item.id)).toEqual(['kick']);
  expect(filterLibrarySongs(songs, 'pop').map(item => item.id)).toEqual(['soft']);
});


test('filterLibrarySongs searches visible title fallbacks plus existing metadata', () => {
  const songs = [
    song({ id: 'filename', title: 'unknown', artist: 'Artist', fileInfo: { filename: 'Artist - Real Song.m4a' } }),
    song({ id: 'stem', title: 'null', artist: 'Someone', fileInfo: { filename: 'Real Song.m4a' } }),
    song({ id: 'uri', title: 'undefined', artist: 'Other', uri: 'content://root/Music%2FUri%20Song.mp3' }),
    song({ id: 'raw', title: 'Raw Title', artist: 'Raw Artist', album: 'Raw Album', genre: 'Raw Genre' }),
  ];

  expect(filterLibrarySongs(songs, 'real song').map(item => item.id)).toEqual(['filename', 'stem']);
  expect(filterLibrarySongs(songs, 'uri song').map(item => item.id)).toEqual(['uri']);
  expect(filterLibrarySongs(songs, 'raw title').map(item => item.id)).toEqual(['raw']);
  expect(filterLibrarySongs(songs, 'raw artist').map(item => item.id)).toEqual(['raw']);
  expect(filterLibrarySongs(songs, 'raw album').map(item => item.id)).toEqual(['raw']);
  expect(filterLibrarySongs(songs, 'raw genre').map(item => item.id)).toEqual(['raw']);
});

test('filterFavoriteSongs uses only stored favorite ids', () => {
  const songs = [
    song({ id: 'a' }),
    song({ id: 'b' }),
    song({ id: 'c' }),
  ];

  expect(filterFavoriteSongs(songs, ['c']).map(item => item.id)).toEqual(['c']);
});
