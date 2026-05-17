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
  createdAt: 1,
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
