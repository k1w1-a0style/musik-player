import { renderHook } from '@testing-library/react-native';
import { useMusicProviderActions } from '../useMusicProviderActions';
import { usePlaybackDomainActions } from '../usePlaybackDomainActions';
import { useLibraryDomainActions } from '../useLibraryDomainActions';
import { usePlaylistDomainActions } from '../usePlaylistDomainActions';
import type { MusicProviderActionsArgs } from '../useMusicProviderActions';
import type { Playlist, Song } from '../../types/Song';

jest.mock('../usePlaybackDomainActions', () => ({
  usePlaybackDomainActions: jest.fn(),
}));

jest.mock('../useLibraryDomainActions', () => ({
  useLibraryDomainActions: jest.fn(),
}));

jest.mock('../usePlaylistDomainActions', () => ({
  usePlaylistDomainActions: jest.fn(),
}));

const mockedUsePlaybackDomainActions = jest.mocked(usePlaybackDomainActions);
const mockedUseLibraryDomainActions = jest.mocked(useLibraryDomainActions);
const mockedUsePlaylistDomainActions = jest.mocked(usePlaylistDomainActions);

const noop = () => undefined;
const noopAsync = async () => undefined;
const song: Song = { id: 's1', title: 'One', artist: 'A' };
const playlist: Playlist = { id: 'pl-1', name: 'List', songIds: ['s1'], createdAt: 1, updatedAt: 1 };
const createSongRef = (current: Song[] = []) => ({ current });

const input: MusicProviderActionsArgs = {
  playback: {
    songsRef: createSongRef([song]),
    queueContextRef: createSongRef([song]),
    baseQueueContextRef: createSongRef([song]),
    nativeQueueRef: createSongRef([song]),
    setPlaybackQueue: noop,
    setCurrentSong: noop,
    currentSongId: 's1',
    shuffle: false,
    setShuffle: noop,
  },
  library: {
    queueContextRef: createSongRef([song]),
    baseQueueContextRef: createSongRef([song]),
    nativeQueueRef: createSongRef([song]),
    setSongsState: noop,
    setCurrentSong: noop,
    setPlaybackQueue: noop,
    setPlaylists: noop,
  },
  playlists: {
    playlists: [playlist],
    setPlaylists: noop,
    songsRef: createSongRef([song]),
  },
};

describe('useMusicProviderActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('composes playback, library, and playlist domain actions without changing public action names', () => {
    const playback = { playSong: noopAsync, playSongNext: async () => true, addSongToQueue: async () => true, toggleShuffle: noopAsync };
    const library = { setSongs: noop, addSongs: noop, updateSongMetadata: noop, applySongMetadataPatches: noop };
    const playlists = {
      createPlaylist: () => playlist,
      saveQueueAsPlaylist: () => null,
      deletePlaylist: noop,
      renamePlaylist: noop,
      addSongToPlaylist: noop,
      removeSongFromPlaylist: noop,
      moveSongInPlaylist: noop,
      playPlaylist: noopAsync,
    };

    mockedUsePlaybackDomainActions.mockReturnValue(playback);
    mockedUseLibraryDomainActions.mockReturnValue(library);
    mockedUsePlaylistDomainActions.mockReturnValue(playlists);

    const { result } = renderHook(() => useMusicProviderActions(input));

    expect(mockedUsePlaybackDomainActions).toHaveBeenCalledWith(input.playback);
    expect(mockedUseLibraryDomainActions).toHaveBeenCalledWith(input.library);
    expect(mockedUsePlaylistDomainActions).toHaveBeenCalledWith({
      ...input.playlists,
      playSong: playback.playSong,
    });
    expect(result.current).toEqual({
      ...playback,
      ...library,
      ...playlists,
    });
    expect(result.current).not.toHaveProperty('visualizer');
    expect(result.current).not.toHaveProperty('fft');
  });
});
