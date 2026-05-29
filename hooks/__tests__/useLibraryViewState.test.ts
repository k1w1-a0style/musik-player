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
  expect(result.current.favoriteSongs.map(item => item.id)).toEqual(['b']);
  expect(result.current.songsForActiveList.map(item => item.id)).toEqual(['b']);
});
