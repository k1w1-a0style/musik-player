import { buildMusicProviderContextInput } from '../musicProviderContextInput';
import type { MusicContextValue } from '../musicContextTypes';

const noopAsync = async () => undefined;
const noop = () => undefined;

const baseValue: MusicContextValue = {
  songs: [{ id: 's1', title: 'One', artist: 'A' }],
  setSongs: noop,
  addSongs: noop,
  updateSongMetadata: noop,
  applySongMetadataPatches: noop,
  currentSong: { id: 's1', title: 'One', artist: 'A' },
  playbackQueue: [{ id: 's1', title: 'One', artist: 'A' }],
  isPlaying: true,
  isBuffering: false,
  playSong: async () => ({ status: 'noop' as const }),
  playSongNext: async () => ({ status: 'noop' as const }),
  addSongToQueue: async () => ({ status: 'noop' as const }),
  togglePlayPause: noopAsync,
  stop: noopAsync,
  seekTo: noopAsync,
  next: noopAsync,
  previous: noopAsync,
  shuffle: false,
  toggleShuffle: async () => ({ status: 'noop' as const }),
  repeatMode: 'off',
  cycleRepeatMode: noopAsync,
  volume: 0.8,
  setVolume: noopAsync,
  eqEnabled: false,
  setEqEnabled: noop,
  eqBands: new Array(10).fill(0),
  setEqBand: noop,
  eqPreset: 'flat',
  applyEqPreset: noop,
  eqNative: null,
  palette: null,
  playlists: [],
  createPlaylist: () => ({ id: 'pl-1', name: 'New', songIds: [], createdAt: 1, updatedAt: 1 }),
  saveQueueAsPlaylist: () => ({ id: 'pl-2', name: 'Queue', songIds: ['s1'], createdAt: 2, updatedAt: 2 }),
  deletePlaylist: noop,
  renamePlaylist: noop,
  addSongToPlaylist: noop,
  removeSongFromPlaylist: noop,
  moveSongInPlaylist: noop,
  playPlaylist: noopAsync,
  isReady: true,
};

describe('buildMusicProviderContextInput', () => {
  test('combines provider sections into a full context value', () => {
    expect(
      buildMusicProviderContextInput({
        state: {
          songs: baseValue.songs,
          currentSong: baseValue.currentSong,
          playbackQueue: baseValue.playbackQueue,
          playlists: baseValue.playlists,
          shuffle: baseValue.shuffle,
          isReady: baseValue.isReady,
        },
        library: {
          setSongs: baseValue.setSongs,
          addSongs: baseValue.addSongs,
          updateSongMetadata: baseValue.updateSongMetadata,
          applySongMetadataPatches: baseValue.applySongMetadataPatches,
        },
        playback: {
          isPlaying: baseValue.isPlaying,
          isBuffering: baseValue.isBuffering,
          playSong: baseValue.playSong,
          playSongNext: baseValue.playSongNext,
          addSongToQueue: baseValue.addSongToQueue,
          togglePlayPause: baseValue.togglePlayPause,
          stop: baseValue.stop,
          seekTo: baseValue.seekTo,
          next: baseValue.next,
          previous: baseValue.previous,
          toggleShuffle: baseValue.toggleShuffle,
          repeatMode: baseValue.repeatMode,
          cycleRepeatMode: baseValue.cycleRepeatMode,
          volume: baseValue.volume,
          setVolume: baseValue.setVolume,
        },
        equalizer: {
          eqEnabled: baseValue.eqEnabled,
          setEqEnabled: baseValue.setEqEnabled,
          eqBands: baseValue.eqBands,
          setEqBand: baseValue.setEqBand,
          eqPreset: baseValue.eqPreset,
          applyEqPreset: baseValue.applyEqPreset,
        },
        audioFeatures: {
          eqNative: baseValue.eqNative,
          palette: baseValue.palette,
        },
        playlists: {
          createPlaylist: baseValue.createPlaylist,
          saveQueueAsPlaylist: baseValue.saveQueueAsPlaylist,
          deletePlaylist: baseValue.deletePlaylist,
          renamePlaylist: baseValue.renamePlaylist,
          addSongToPlaylist: baseValue.addSongToPlaylist,
          removeSongFromPlaylist: baseValue.removeSongFromPlaylist,
          moveSongInPlaylist: baseValue.moveSongInPlaylist,
          playPlaylist: baseValue.playPlaylist,
        },
      }),
    ).toEqual(baseValue);
  });
});
