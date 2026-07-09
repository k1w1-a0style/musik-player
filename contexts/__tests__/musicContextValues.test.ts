import {
  buildLibraryMusicContextValue,
  buildMiniPlayerMusicContextValue,
  buildNowPlayingMusicContextValue,
} from '../musicContextValues';
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
  playbackQueue: [
    { id: 's1', title: 'One', artist: 'A' },
    { id: 's2', title: 'Two', artist: 'A' },
  ],
  isPlaying: true,
  isBuffering: false,
  playSong: noopAsync,
  togglePlayPause: noopAsync,
  stop: noopAsync,
  seekTo: noopAsync,
  next: noopAsync,
  previous: noopAsync,
  shuffle: false,
  toggleShuffle: noopAsync,
  repeatMode: 'off',
  cycleRepeatMode: noopAsync,
  volume: 0.8,
  setVolume: noopAsync,
  eqEnabled: false,
  setEqEnabled: noop,
  eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  setEqBand: noop,
  eqPreset: 'flat',
  applyEqPreset: noop,
  eqNative: null,
  palette: null,
  playlists: [{ id: 'pl-1', name: 'List', songIds: ['s1'], createdAt: 1, updatedAt: 1 }],
  createPlaylist: () => ({ id: 'pl-2', name: 'New', songIds: [], createdAt: 2, updatedAt: 2 }),
  saveQueueAsPlaylist: () => ({ id: 'pl-3', name: 'Queue', songIds: ['s1'], createdAt: 3, updatedAt: 3 }),
  deletePlaylist: noop,
  renamePlaylist: noop,
  addSongToPlaylist: noop,
  removeSongFromPlaylist: noop,
  playPlaylist: noopAsync,
  isReady: true,
};

describe('music context value builders', () => {
  test('builds the library slice', () => {
    expect(buildLibraryMusicContextValue(baseValue)).toEqual({
      songs: baseValue.songs,
      setSongs: baseValue.setSongs,
      currentSong: baseValue.currentSong,
      playSong: baseValue.playSong,
      isReady: true,
      isPlaying: true,
      updateSongMetadata: baseValue.updateSongMetadata,
      applySongMetadataPatches: baseValue.applySongMetadataPatches,
      playlists: baseValue.playlists,
      deletePlaylist: baseValue.deletePlaylist,
      renamePlaylist: baseValue.renamePlaylist,
      addSongToPlaylist: baseValue.addSongToPlaylist,
      removeSongFromPlaylist: baseValue.removeSongFromPlaylist,
      playPlaylist: baseValue.playPlaylist,
    });
  });

  test('builds the mini player slice with skip flags', () => {
    expect(buildMiniPlayerMusicContextValue(baseValue)).toMatchObject({
      currentSong: baseValue.currentSong,
      isPlaying: true,
      canSkipNext: true,
      canSkipPrevious: true,
    });
  });

  test('requires a current song before allowing mini player next skips', () => {
    expect(
      buildMiniPlayerMusicContextValue({
        ...baseValue,
        currentSong: null,
        playbackQueue: [baseValue.playbackQueue[0], baseValue.playbackQueue[1]],
      }),
    ).toMatchObject({
      canSkipNext: false,
      canSkipPrevious: false,
    });

    expect(
      buildMiniPlayerMusicContextValue({
        ...baseValue,
        currentSong: baseValue.currentSong,
        playbackQueue: [baseValue.playbackQueue[0], baseValue.playbackQueue[1]],
      }),
    ).toMatchObject({
      canSkipNext: true,
      canSkipPrevious: true,
    });

    expect(
      buildMiniPlayerMusicContextValue({
        ...baseValue,
        currentSong: baseValue.currentSong,
        playbackQueue: [baseValue.playbackQueue[0]],
      }),
    ).toMatchObject({
      canSkipNext: false,
      canSkipPrevious: true,
    });
  });

  test('builds the now playing slice with skip actions and canSkip flag', () => {
    expect(buildNowPlayingMusicContextValue(baseValue)).toMatchObject({
      playbackQueue: baseValue.playbackQueue,
      currentSong: baseValue.currentSong,
      volume: 0.8,
      next: baseValue.next,
      previous: baseValue.previous,
      saveQueueAsPlaylist: baseValue.saveQueueAsPlaylist,
      canSkip: true,
    });
  });
});
