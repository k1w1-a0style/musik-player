import React from 'react';
import { Text } from 'react-native';
import { act, render, renderHook } from '@testing-library/react-native';
import TrackPlayer from 'react-native-track-player';
import { useProvidedMusicContextValues } from '../useProvidedMusicContextValues';
import type { MusicContextValue } from '../musicContextTypes';
import { resetSleepTimerForTests } from '../../services/sleepTimerController';

const noopAsync = async () => undefined;
const mockTogglePlayPause = jest.fn(noopAsync);
const noop = () => undefined;
const deletePlaylist = jest.fn();
const renamePlaylist = jest.fn();
const addSongToPlaylist = jest.fn();
const removeSongFromPlaylist = jest.fn();
const moveSongInPlaylist = jest.fn();
const saveQueueAsPlaylist = () => ({ id: 'pl-3', name: 'Queue', songIds: ['s1'], createdAt: 3, updatedAt: 3 });

const baseValue: MusicContextValue = {
  songs: [{ id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' }],
  setSongs: noop,
  addSongs: noop,
  updateSongMetadata: noop,
  applySongMetadataPatches: noop,
  currentSong: { id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' },
  playbackQueue: [
    { id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' },
    { id: 's2', title: 'Two', artist: 'A', uri: 'file:///s2.mp3' },
  ],
  isPlaying: true,
  isBuffering: false,
  playSong: async () => ({ status: 'noop' as const }),
  playSongNext: async () => ({ status: 'noop' as const }),
  addSongToQueue: async () => ({ status: 'noop' as const }),
  togglePlayPause: mockTogglePlayPause,
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
  playlists: [{ id: 'pl-1', name: 'List', songIds: ['s1'], createdAt: 1, updatedAt: 1 }],
  createPlaylist: () => ({ id: 'pl-2', name: 'New', songIds: [], createdAt: 2, updatedAt: 2 }),
  saveQueueAsPlaylist,
  deletePlaylist,
  renamePlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
  moveSongInPlaylist,
  playPlaylist: noopAsync,
  isReady: true,
};

const ValuesProbe = () => {
  const { value, libraryValue, miniPlayerValue, nowPlayingValue } =
    useProvidedMusicContextValues(baseValue);

  return (
    <>
      <Text testID="full-ready">{String(value.isReady)}</Text>
      <Text testID="library-songs">{libraryValue.songs.length}</Text>
      <Text testID="library-delete-ref">{String(libraryValue.deletePlaylist === deletePlaylist)}</Text>
      <Text testID="library-rename-ref">{String(libraryValue.renamePlaylist === renamePlaylist)}</Text>
      <Text testID="library-add-song-ref">{String(libraryValue.addSongToPlaylist === addSongToPlaylist)}</Text>
      <Text testID="library-remove-song-ref">{String(libraryValue.removeSongFromPlaylist === removeSongFromPlaylist)}</Text>
      <Text testID="library-move-song-ref">{String(libraryValue.moveSongInPlaylist === moveSongInPlaylist)}</Text>
      <Text testID="mini-can-next">{String(miniPlayerValue.canSkipNext)}</Text>
      <Text testID="now-can-skip">{String(nowPlayingValue.canSkip)}</Text>
      <Text testID="now-volume">{String(nowPlayingValue.volume)}</Text>
      <Text testID="sleep-active">{String(nowPlayingValue.sleepTimerActive)}</Text>
      <Text testID="now-queue-save-name">{nowPlayingValue.saveQueueAsPlaylist('Queue', nowPlayingValue.playbackQueue)?.name}</Text>
    </>
  );
};

describe('useProvidedMusicContextValues', () => {
  beforeEach(() => {
    resetSleepTimerForTests();
    jest.clearAllMocks();
  });
  test('builds provided context values from the full music value', () => {
    const { getByTestId } = render(<ValuesProbe />);

    expect(getByTestId('full-ready').props.children).toBe('true');
    expect(getByTestId('library-songs').props.children).toBe(1);
    expect(getByTestId('library-delete-ref').props.children).toBe('true');
    expect(getByTestId('library-rename-ref').props.children).toBe('true');
    expect(getByTestId('library-add-song-ref').props.children).toBe('true');
    expect(getByTestId('library-remove-song-ref').props.children).toBe('true');
    expect(getByTestId('library-move-song-ref').props.children).toBe('true');
    expect(getByTestId('mini-can-next').props.children).toBe('true');
    expect(getByTestId('now-can-skip').props.children).toBe('true');
    expect(getByTestId('now-volume').props.children).toBe('0.8');
    expect(getByTestId('sleep-active').props.children).toBe('false');
    expect(getByTestId('now-queue-save-name').props.children).toBe('Queue');
  });


  test('keeps the sleep timer alive in the provider slice until provider unmount', async () => {
    jest.useFakeTimers();
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    await TrackPlayer.play();
    jest.clearAllMocks();
    const initialQueue = baseValue.playbackQueue;
    const initialSong = baseValue.currentSong;
    const { result, unmount } = renderHook(() => useProvidedMusicContextValues(baseValue));

    act(() => {
      result.current.nowPlayingValue.startSleepTimer(15);
    });
    expect(result.current.nowPlayingValue.sleepTimerActive).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(15 * 60 * 1000);
      await Promise.resolve();
    });

    expect(TrackPlayer.pause).toHaveBeenCalledTimes(1);
    expect(mockTogglePlayPause).not.toHaveBeenCalled();
    expect(result.current.nowPlayingValue.playbackQueue).toBe(initialQueue);
    expect(result.current.nowPlayingValue.currentSong).toBe(initialSong);

    act(() => {
      result.current.nowPlayingValue.startSleepTimer(30);
    });
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
    jest.useRealTimers();
  });

  test('does not start playback when the sleep timer expires while already paused', async () => {
    jest.useFakeTimers();
    await TrackPlayer.pause();
    jest.clearAllMocks();
    const pausedValue: MusicContextValue = { ...baseValue, isPlaying: false };
    const { result } = renderHook(() => useProvidedMusicContextValues(pausedValue));

    await act(async () => {
      result.current.nowPlayingValue.startSleepTimer(15);
      jest.advanceTimersByTime(15 * 60 * 1000);
      await Promise.resolve();
    });

    expect(TrackPlayer.pause).not.toHaveBeenCalled();
    expect(mockTogglePlayPause).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  test('keeps slice references stable when unrelated fields change', () => {
    const firstValue: MusicContextValue = { ...baseValue, isBuffering: false };
    const secondValue: MusicContextValue = { ...baseValue, isBuffering: true };

    const { result, rerender } = renderHook(
      ({ value }: { value: MusicContextValue }) => useProvidedMusicContextValues(value),
      { initialProps: { value: firstValue } },
    );
    const firstLibrary = result.current.libraryValue;
    const firstMini = result.current.miniPlayerValue;
    const firstNowPlaying = result.current.nowPlayingValue;

    rerender({ value: secondValue });

    expect(result.current.libraryValue).toBe(firstLibrary);
    expect(result.current.miniPlayerValue).toBe(firstMini);
    expect(result.current.nowPlayingValue).toBe(firstNowPlaying);
  });
});
