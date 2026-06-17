import React from 'react';
import { Text } from 'react-native';
import { render, renderHook } from '@testing-library/react-native';
import { useProvidedMusicContextValues } from '../useProvidedMusicContextValues';
import type { MusicContextValue } from '../musicContextTypes';

const noopAsync = async () => undefined;
const noop = () => undefined;
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
  eqBands: new Array(10).fill(0),
  setEqBand: noop,
  eqPreset: 'flat',
  applyEqPreset: noop,
  eqNative: null,
  palette: null,
  playlists: [{ id: 'pl-1', name: 'List', songIds: ['s1'], createdAt: 1, updatedAt: 1 }],
  createPlaylist: () => ({ id: 'pl-2', name: 'New', songIds: [], createdAt: 2, updatedAt: 2 }),
  saveQueueAsPlaylist,
  deletePlaylist: noop,
  renamePlaylist: noop,
  addSongToPlaylist: noop,
  removeSongFromPlaylist: noop,
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
      <Text testID="mini-can-next">{String(miniPlayerValue.canSkipNext)}</Text>
      <Text testID="now-can-skip">{String(nowPlayingValue.canSkip)}</Text>
      <Text testID="now-volume">{String(nowPlayingValue.volume)}</Text>
      <Text testID="now-queue-save-name">{nowPlayingValue.saveQueueAsPlaylist('Queue', nowPlayingValue.playbackQueue)?.name}</Text>
    </>
  );
};

describe('useProvidedMusicContextValues', () => {
  test('builds provided context values from the full music value', () => {
    const { getByTestId } = render(<ValuesProbe />);

    expect(getByTestId('full-ready').props.children).toBe('true');
    expect(getByTestId('library-songs').props.children).toBe(1);
    expect(getByTestId('mini-can-next').props.children).toBe('true');
    expect(getByTestId('now-can-skip').props.children).toBe('true');
    expect(getByTestId('now-volume').props.children).toBe('0.8');
    expect(getByTestId('now-queue-save-name').props.children).toBe('Queue');
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
