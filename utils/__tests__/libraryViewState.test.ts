import { buildLibraryViewState } from '../libraryViewState';
import type { Playlist, Song } from '../../types/Song';
import type { ScanFolder } from '../../types/ScanFolder';

const song = (patch: Partial<Song>): Song => ({
  id: 'song-1',
  title: 'Track One',
  artist: 'Artist',
  album: 'Album',
  genre: 'Genre',
  uri: 'track-one',
  ...patch,
});

const playlist = (patch: Partial<Playlist>): Playlist => ({
  id: 'playlist-1',
  name: 'Playlist',
  songIds: [],
  createdAt: 1, updatedAt: 1,
  ...patch,
});

const folder = (id: string, enabled: boolean): ScanFolder => ({
  id,
  name: id,
  uri: id,
  addedAt: 1,
  enabled,
});

test('buildLibraryViewState derives filtered library lists and groups', () => {
  const songs = [
    song({ id: 'a', title: 'Alpha', artist: 'One', album: 'First', genre: 'Techno' }),
    song({ id: 'b', title: 'Beta', artist: 'Two', album: 'Second', genre: 'House' }),
  ];

  const state = buildLibraryViewState({
    activeTab: 'tracks',
    favoriteIds: ['b'],
    isDev: false,
    isReady: true,
    nodeEnv: 'test',
    playlists: [playlist({ songIds: ['b'] })],
    query: 'Beta',
    scanFolders: [folder('enabled', true), folder('disabled', false)],
    songs,
  });

  expect(state.activeFolders).toBe(1);
  expect(state.filteredSongs.map(item => item.id)).toEqual(['b']);
  expect(state.favoriteSongs.map(item => item.id)).toEqual(['b']);
  expect(state.songsForActiveList.map(item => item.id)).toEqual(['b']);
  expect(state.albumGroups.map(item => item.title)).toEqual(['Second']);
  expect(state.artistGroups.map(item => item.title)).toEqual(['Two']);
  expect(state.genreGroups.map(item => item.title)).toEqual(['House']);
  expect(state.playlistItems).toHaveLength(1);
});

test('buildLibraryViewState builds sorted playlist items with valid counts', () => {
  const songs = [
    song({ id: 'a', title: 'Alpha', artist: 'One' }),
    song({ id: 'b', title: 'Beta', artist: 'Two' }),
  ];

  const state = buildLibraryViewState({
    activeTab: 'playlists',
    favoriteIds: [],
    isDev: false,
    isReady: true,
    nodeEnv: 'test',
    playlists: [
      playlist({ id: 'workout', name: 'Workout', songIds: ['b', 'missing'] }),
      playlist({ id: 'alpha', name: 'Alpha Mix', songIds: ['a', 'b'] }),
    ],
    query: '',
    scanFolders: [],
    songs,
  });

  expect(state.playlistItems.map(item => item.name)).toEqual(['Alpha Mix', 'Workout']);
  expect(state.playlistItems.find(item => item.name === 'Alpha Mix')?.validCount).toBe(2);
  expect(state.playlistItems.find(item => item.name === 'Workout')?.validCount).toBe(1);
  expect(state.playlistItems.find(item => item.name === 'Workout')?.totalCount).toBe(2);
});

test('buildLibraryViewState uses favorite songs as active list on favorites tab', () => {
  const songs = [song({ id: 'a', title: 'Alpha' }), song({ id: 'b', title: 'Beta' })];

  const state = buildLibraryViewState({
    activeTab: 'favorites',
    favoriteIds: ['b'],
    isDev: false,
    isReady: true,
    nodeEnv: 'test',
    playlists: [],
    query: '',
    scanFolders: [],
    songs,
  });

  expect(state.songsForActiveList.map(item => item.id)).toEqual(['b']);
  expect(state.emptyMessage).toBe('Noch keine Favoriten markiert.');
});