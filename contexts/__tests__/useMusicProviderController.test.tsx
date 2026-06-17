import { renderHook } from '@testing-library/react-native';
import { useMusicProviderController } from '../useMusicProviderController';
import { useMusicProviderContextComposition } from '../useMusicProviderContextComposition';
import { useMusicProviderDomainActions } from '../useMusicProviderDomainActions';
import { useMusicProviderDomainEffects } from '../useMusicProviderDomainEffects';
import { useMusicProviderRuntime } from '../useMusicProviderRuntime';
import type { MusicContextValue } from '../musicContextTypes';
import type { Song } from '../../types/Song';

jest.mock('../useMusicProviderRuntime', () => ({
  useMusicProviderRuntime: jest.fn(),
}));

jest.mock('../useMusicProviderDomainActions', () => ({
  useMusicProviderDomainActions: jest.fn(),
}));

jest.mock('../useMusicProviderDomainEffects', () => ({
  useMusicProviderDomainEffects: jest.fn(),
}));

jest.mock('../useMusicProviderContextComposition', () => ({
  useMusicProviderContextComposition: jest.fn(),
}));

const mockedUseRuntime = jest.mocked(useMusicProviderRuntime);
const mockedUseActions = jest.mocked(useMusicProviderDomainActions);
const mockedUseEffects = jest.mocked(useMusicProviderDomainEffects);
const mockedUseComposition = jest.mocked(useMusicProviderContextComposition);

describe('useMusicProviderController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('orchestrates runtime, actions, effects, and context composition without rebuilding details inline', () => {
    const noop = () => undefined;
    const noopAsync = async () => undefined;
    const song: Song = { id: 's1', title: 'One', artist: 'A' };
    const createSongRef = (current: Song[] = []) => ({ current });
    const runtime: ReturnType<typeof useMusicProviderRuntime> = {
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
        shuffle: false,
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
        eqBands: new Array(10).fill(0),
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
    const actions: ReturnType<typeof useMusicProviderDomainActions> = {
      playSong: jest.fn(),
      toggleShuffle: jest.fn(),
      setSongs: noop,
      addSongs: noop,
      updateSongMetadata: noop,
  applySongMetadataPatches: noop,
      createPlaylist: () => ({ id: 'pl-1', name: 'New', songIds: [], createdAt: 1, updatedAt: 1 }),
      saveQueueAsPlaylist: () => ({ id: 'pl-2', name: 'Queue', songIds: ['s1'], createdAt: 2, updatedAt: 2 }),
      deletePlaylist: noop,
      renamePlaylist: noop,
      addSongToPlaylist: noop,
      removeSongFromPlaylist: noop,
      playPlaylist: noopAsync,
    };
    const value: MusicContextValue = {
      songs: [song],
      setSongs: actions.setSongs,
      addSongs: actions.addSongs,
      updateSongMetadata: actions.updateSongMetadata,
      applySongMetadataPatches: actions.applySongMetadataPatches,
      currentSong: song,
      playbackQueue: [song],
      isPlaying: true,
      isBuffering: false,
      playSong: actions.playSong,
      togglePlayPause: noopAsync,
      stop: noopAsync,
      seekTo: noopAsync,
      next: noopAsync,
      previous: noopAsync,
      shuffle: false,
      toggleShuffle: actions.toggleShuffle,
      repeatMode: 'off',
      cycleRepeatMode: noopAsync,
      volume: 0.8,
      setVolume: noopAsync,
      eqEnabled: false,
      setEqEnabled: noop,
      eqBands: [],
      setEqBand: noop,
      eqPreset: 'flat',
      applyEqPreset: noop,
      eqNative: null,
      palette: null,
      playlists: [],
      createPlaylist: actions.createPlaylist,
      saveQueueAsPlaylist: actions.saveQueueAsPlaylist,
      deletePlaylist: actions.deletePlaylist,
      renamePlaylist: actions.renamePlaylist,
      addSongToPlaylist: actions.addSongToPlaylist,
      removeSongFromPlaylist: actions.removeSongFromPlaylist,
      playPlaylist: actions.playPlaylist,
      isReady: true,
    };
    const values: ReturnType<typeof useMusicProviderContextComposition> = {
      value,
      libraryValue: {
        songs: value.songs,
        setSongs: value.setSongs,
        currentSong: value.currentSong,
        playSong: value.playSong,
        isReady: value.isReady,
        isPlaying: value.isPlaying,
        updateSongMetadata: value.updateSongMetadata,
        applySongMetadataPatches: value.applySongMetadataPatches,
        playlists: value.playlists,
        playPlaylist: value.playPlaylist,
      },
      miniPlayerValue: {
        currentSong: value.currentSong,
        isPlaying: value.isPlaying,
        togglePlayPause: value.togglePlayPause,
        next: value.next,
        previous: value.previous,
        canSkipNext: false,
        canSkipPrevious: false,
      },
      nowPlayingValue: {
        playbackQueue: value.playbackQueue,
        currentSong: value.currentSong,
        seekTo: value.seekTo,
        isPlaying: value.isPlaying,
        volume: value.volume,
        setVolume: value.setVolume,
        palette: value.palette,
        playSong: value.playSong,
        saveQueueAsPlaylist: value.saveQueueAsPlaylist,
        canSkip: false,
      },
    };

    mockedUseRuntime.mockReturnValue(runtime);
    mockedUseActions.mockReturnValue(actions);
    mockedUseComposition.mockReturnValue(values);

    const { result } = renderHook(() => useMusicProviderController());

    expect(mockedUseRuntime).toHaveBeenCalledTimes(1);
    expect(mockedUseActions).toHaveBeenCalledWith(runtime);
    expect(mockedUseEffects).toHaveBeenCalledWith(runtime);
    expect(mockedUseComposition).toHaveBeenCalledWith(runtime, actions);
    expect(result.current).toBe(values);
  });
});
