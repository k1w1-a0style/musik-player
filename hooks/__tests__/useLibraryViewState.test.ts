import { renderHook } from '@testing-library/react-native';
import { useLibraryViewState, type UseLibraryViewStateOptions } from '../useLibraryViewState';
import type { Song } from '../../types/Song';
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

const folder = (id: string, enabled: boolean): ScanFolder => ({
  id,
  name: id,
  uri: id,
  addedAt: 1,
  enabled,
});

test('returns derived library view state', () => {
  const options: UseLibraryViewStateOptions = {
    activeTab: 'tracks',
    favoriteIds: ['b'],
    isDev: false,
    isReady: true,
    nodeEnv: 'test',
    playlists: [],
    query: 'Beta',
    scanFolders: [folder('enabled', true), folder('disabled', false)],
    songs: [
      song({ id: 'a', title: 'Alpha' }),
      song({ id: 'b', title: 'Beta' }),
    ],
  };

  const { result } = renderHook(() => useLibraryViewState(options));

  expect(result.current.activeFolders).toBe(1);
  expect(result.current.filteredSongs.map(item => item.id)).toEqual(['b']);
  expect(result.current.favoriteSongs).toEqual([]);
  expect(result.current.songsForActiveList.map(item => item.id)).toEqual(['b']);
  expect(result.current.albumGroups).toEqual([]);
  expect(result.current.artistGroups).toEqual([]);
  expect(result.current.genreGroups).toEqual([]);
  expect(result.current.playlistItems).toEqual([]);
});

test('builds only the expensive collection required by the active tab', () => {
  const base: UseLibraryViewStateOptions = {
    activeTab: 'albums',
    favoriteIds: ['a'],
    isDev: false,
    isReady: true,
    nodeEnv: 'test',
    playlists: [{ id: 'playlist', name: 'Playlist', songIds: ['a'], createdAt: 1, updatedAt: 1 }],
    query: '',
    scanFolders: [],
    songs: [song({ id: 'a' }), song({ id: 'b', album: 'Second Album' })],
  };
  const rendered = renderHook(
    ({ options }: { options: UseLibraryViewStateOptions }) => useLibraryViewState(options),
    { initialProps: { options: base } },
  );

  expect(rendered.result.current.albumGroups).toHaveLength(2);
  expect(rendered.result.current.artistGroups).toEqual([]);
  expect(rendered.result.current.genreGroups).toEqual([]);
  expect(rendered.result.current.favoriteSongs).toEqual([]);
  expect(rendered.result.current.playlistItems).toEqual([]);
  const albumGroups = rendered.result.current.albumGroups;

  rendered.rerender({ options: { ...base, favoriteIds: ['b'] } });
  expect(rendered.result.current.albumGroups).toBe(albumGroups);

  rendered.rerender({ options: { ...base, activeTab: 'favorites' } });
  expect(rendered.result.current.albumGroups).toEqual([]);
  expect(rendered.result.current.favoriteSongs.map(item => item.id)).toEqual(['a']);
});
