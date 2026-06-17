import { renderHook } from '@testing-library/react-native';
import { useMusicProviderActions } from '../useMusicProviderActions';
import { useMusicProviderDomainActions } from '../useMusicProviderDomainActions';
import type { MusicProviderRuntime } from '../useMusicProviderRuntime';
import type { Song } from '../../types/Song';

jest.mock('../useMusicProviderActions', () => ({
  useMusicProviderActions: jest.fn(),
}));

const mockedUseMusicProviderActions = jest.mocked(useMusicProviderActions);
const noop = () => undefined;
const noopAsync = async () => undefined;
const song: Song = { id: 's1', title: 'One', artist: 'A' };
const createSongRef = (current: Song[] = []) => ({ current });

const runtime: MusicProviderRuntime = {
  state: {
    isReady: true,
    setIsReady: noop,
    songs: [song],
    setSongsState: noop,
    currentSong: song,
    setCurrentSong: noop,
    playbackQueue: [song],
    setPlaybackQueue: noop,
    playlists: [],
    setPlaylists: noop,
    shuffle: true,
    setShuffle: noop,
  },
  playback: {
    isPlaying: true,
    isBuffering: false,
    repeatMode: 'off',
    setRepeatMode: noop,
    cycleRepeatMode: noopAsync,
    volume: 0.8,
    setVolumeState: noop,
    setVolume: noopAsync,
    togglePlayPause: noopAsync,
    stop: noopAsync,
    seekTo: noopAsync,
    next: noopAsync,
    previous: noopAsync,
  },
  equalizer: {
    eqEnabled: false,
    setEqEnabled: noop,
    setEqEnabledState: noop,
    eqBands: [],
    setEqBand: noop,
    setEqBandsState: noop,
    eqPreset: 'flat',
    applyEqPreset: noop,
    setEqPreset: noop,
  },
  audioFeatures: { eqNative: null, palette: null },
  refs: {
    songsRef: createSongRef([song]),
    queueContextRef: createSongRef([song]),
    baseQueueContextRef: createSongRef([song]),
    nativeQueueRef: createSongRef([song]),
    persistCurrentSongId: noopAsync,
  },
};

describe('useMusicProviderDomainActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('derives currentSongId once from runtime state and passes only action dependencies', () => {
    const actions = {
      playSong: noopAsync,
      toggleShuffle: noopAsync,
      setSongs: noop,
      addSongs: noop,
      updateSongMetadata: noop,
  applySongMetadataPatches: noop,
      createPlaylist: () => ({ id: 'pl-1', name: 'New', songIds: [], createdAt: 1, updatedAt: 1 }),
      saveQueueAsPlaylist: () => null,
      deletePlaylist: noop,
      renamePlaylist: noop,
      addSongToPlaylist: noop,
      removeSongFromPlaylist: noop,
      playPlaylist: noopAsync,
    };
    mockedUseMusicProviderActions.mockReturnValue(actions);

    const { result } = renderHook(() => useMusicProviderDomainActions(runtime));

    expect(result.current).toBe(actions);
    expect(mockedUseMusicProviderActions).toHaveBeenCalledWith({
      playback: {
        songsRef: runtime.refs.songsRef,
        queueContextRef: runtime.refs.queueContextRef,
        baseQueueContextRef: runtime.refs.baseQueueContextRef,
        nativeQueueRef: runtime.refs.nativeQueueRef,
        setPlaybackQueue: runtime.state.setPlaybackQueue,
        setCurrentSong: runtime.state.setCurrentSong,
        currentSongId: 's1',
        shuffle: true,
        setShuffle: runtime.state.setShuffle,
      },
      library: {
        queueContextRef: runtime.refs.queueContextRef,
        baseQueueContextRef: runtime.refs.baseQueueContextRef,
        nativeQueueRef: runtime.refs.nativeQueueRef,
        setSongsState: runtime.state.setSongsState,
        setCurrentSong: runtime.state.setCurrentSong,
        setPlaybackQueue: runtime.state.setPlaybackQueue,
        setPlaylists: runtime.state.setPlaylists,
      },
      playlists: {
        playlists: runtime.state.playlists,
        setPlaylists: runtime.state.setPlaylists,
        songsRef: runtime.refs.songsRef,
      },
    });
  });
});
