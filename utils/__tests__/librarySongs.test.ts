import { filterFavoriteSongs, filterLibrarySongs } from '../librarySongs';
import type { Song } from '../../types/Song';

const song = (patch: Partial<Song>): Song => ({
  id: patch.id ?? 's1',
  title: patch.title ?? 'Title',
  artist: patch.artist ?? 'Artist',
  album: patch.album,
  genre: patch.genre,
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

test('filterFavoriteSongs uses only stored favorite ids', () => {
  const songs = [
    song({ id: 'a' }),
    song({ id: 'b' }),
    song({ id: 'c' }),
  ];

  expect(filterFavoriteSongs(songs, ['c']).map(item => item.id)).toEqual(['c']);
});
