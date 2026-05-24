import { buildLibraryPlaylistItems } from '../libraryPlaylists';
import type { Playlist, Song } from '../../types/Song';

const song = (patch: Partial<Song>): Song => ({
  id: patch.id ?? 's1',
  title: patch.title ?? 'Title',
  artist: patch.artist ?? 'Artist',
  album: patch.album,
  genre: patch.genre,
});

const playlist = (patch: Partial<Playlist>): Playlist => ({
  id: patch.id ?? 'p1',
  name: patch.name ?? 'Playlist',
  songIds: patch.songIds ?? [],
  createdAt: patch.createdAt ?? 1,
  updatedAt: patch.updatedAt ?? patch.createdAt ?? 1,
});

test('builds playlist items with valid and missing song counts', () => {
  const items = buildLibraryPlaylistItems(
    [playlist({ id: 'p1', name: 'Mix', songIds: ['s1', 'missing'] })],
    [song({ id: 's1', title: 'One' })],
  );

  expect(items).toEqual([
    {
      id: 'p1',
      name: 'Mix',
      songs: [expect.objectContaining({ id: 's1' })],
      validCount: 1,
      totalCount: 2,
    },
  ]);
});

test('sorts playlists by name', () => {
  const items = buildLibraryPlaylistItems(
    [playlist({ id: 'b', name: 'Zulu' }), playlist({ id: 'a', name: 'Alpha' })],
    [],
  );

  expect(items.map(item => item.name)).toEqual(['Alpha', 'Zulu']);
});

test('filters by playlist name and song metadata', () => {
  const songs = [
    song({ id: 's1', title: 'Kick', artist: 'DJ One', album: 'Album', genre: 'Techno' }),
    song({ id: 's2', title: 'Ballad', artist: 'Singer', album: 'Soft', genre: 'Pop' }),
  ];
  const playlists = [
    playlist({ id: 'p1', name: 'Hard Mix', songIds: ['s1'] }),
    playlist({ id: 'p2', name: 'Chill', songIds: ['s2'] }),
  ];

  expect(buildLibraryPlaylistItems(playlists, songs, 'hard').map(item => item.id)).toEqual(['p1']);
  expect(buildLibraryPlaylistItems(playlists, songs, 'techno').map(item => item.id)).toEqual(['p1']);
  expect(buildLibraryPlaylistItems(playlists, songs, 'singer').map(item => item.id)).toEqual(['p2']);
});

test('filters with trimmed case-insensitive query', () => {
  const items = buildLibraryPlaylistItems(
    [playlist({ id: 'p1', name: 'Hard Mix', songIds: [] })],
    [],
    '  HARD  ',
  );

  expect(items.map(item => item.id)).toEqual(['p1']);
});

test('filters by display metadata fallbacks', () => {
  const songs = [song({ id: 's1', title: 'Kick', artist: '', album: undefined, genre: undefined })];
  const playlists = [playlist({ id: 'p1', name: 'Fallback Mix', songIds: ['s1'] })];

  expect(buildLibraryPlaylistItems(playlists, songs, 'unbekannt').map(item => item.id)).toEqual(['p1']);
  expect(buildLibraryPlaylistItems(playlists, songs, 'unbekanntes album').map(item => item.id)).toEqual(['p1']);
  expect(buildLibraryPlaylistItems(playlists, songs, 'unbekanntes genre').map(item => item.id)).toEqual(['p1']);
});
