import { renderHook } from '@testing-library/react-native';
import { useMusicProviderContextComposition } from '../useMusicProviderContextComposition';
import type { MusicProviderRuntime } from '../useMusicProviderRuntime';
import type { MusicProviderDomainActions } from '../useMusicProviderDomainActions';
import type { Song } from '../../types/Song';

const noop = () => undefined;
const noopAsync = async () => undefined;
const song: Song = { id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' };
const createSongRef = (current: Song[] = []) => ({ current });

const runtime: MusicProviderRuntime = {
  state: {
    isReady: true,
    setIsReady: noop,
    libraryHydrationReady: true,
    setLibraryHydrationReady: noop,
    songs: [song],
    setSongsState: noop,
    currentSong: song,
    setCurrentSong: noop,
    playbackQueue: [song],
    setPlaybackQueue: noop,
    playlists: [{ id: 'pl-1', name: 'List', songIds: ['s1'], createdAt: 1, updatedAt: 1 }],
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
  audioFeatures: {
    eqNative: null,
    palette: { dominant: '#111111' },
  },
  refs: {
    songsRef: createSongRef([song]),
    queueContextRef: createSongRef([song]),
    baseQueueContextRef: createSongRef([song]),
    nativeQueueRef: createSongRef([song]),
    persistCurrentSongId: noopAsync,
  },
};

const actions: MusicProviderDomainActions = {
  playSong: async () => ({ status: 'noop' as const }),
  playSongNext: async () => ({ status: 'noop' as const }),
  addSongToQueue: async () => ({ status: 'noop' as const }),
  toggleShuffle: async () => ({ status: 'noop' as const }),
  setSongs: noop,
  addSongs: noop,
  updateSongMetadata: noop,
  applySongMetadataPatches: noop,
  createPlaylist: () => ({ id: 'pl-2', name: 'New', songIds: [], createdAt: 2, updatedAt: 2 }),
  saveQueueAsPlaylist: () => ({ id: 'pl-3', name: 'Queue', songIds: ['s1'], createdAt: 3, updatedAt: 3 }),
  deletePlaylist: noop,
  renamePlaylist: noop,
  addSongToPlaylist: noop,
  removeSongFromPlaylist: noop,
  moveSongInPlaylist: noop,
  playPlaylist: noopAsync,
};

describe('useMusicProviderContextComposition', () => {
  test('provides full and sliced context values without visualizer fields', () => {
    const { result } = renderHook(() => useMusicProviderContextComposition(runtime, actions));

    expect(result.current.value.currentSong).toBe(song);
    expect(result.current.value.playSong).toBe(actions.playSong);
    expect(result.current.value.toggleShuffle).toBe(actions.toggleShuffle);
    expect(result.current.libraryValue).toMatchObject({
      songs: [song],
      currentSong: song,
      isReady: true,
      moveSongInPlaylist: actions.moveSongInPlaylist,
    });
    expect(result.current.miniPlayerValue).toMatchObject({
      currentSong: song,
      isPlaying: true,
      canSkipNext: false,
    });
    expect(result.current.nowPlayingValue).toMatchObject({
      currentSong: song,
      volume: 0.8,
      palette: { dominant: '#111111' },
    });
    expect(result.current.value).not.toHaveProperty('visualizer');
    expect(result.current.value).not.toHaveProperty('fft');
    expect(result.current.libraryValue).not.toHaveProperty('seekTo');
    expect(result.current.miniPlayerValue).not.toHaveProperty('volume');
  });
});
