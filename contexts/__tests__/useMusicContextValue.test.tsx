import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { useMusicContextValue } from '../useMusicContextValue';
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

const ValueProbe = () => {
  const value = useMusicContextValue(baseValue);
  return (
    <>
      <Text testID="ready">{String(value.isReady)}</Text>
      <Text testID="songs-count">{value.songs.length}</Text>
      <Text testID="volume">{String(value.volume)}</Text>
      <Text testID="queue-save-name">{value.saveQueueAsPlaylist('Queue', value.playbackQueue)?.name}</Text>
    </>
  );
};

describe('useMusicContextValue', () => {
  test('returns the full music context value', () => {
    const { getByTestId } = render(<ValueProbe />);

    expect(getByTestId('ready').props.children).toBe('true');
    expect(getByTestId('songs-count').props.children).toBe(1);
    expect(getByTestId('volume').props.children).toBe('0.8');
    expect(getByTestId('queue-save-name').props.children).toBe('Queue');
  });
});
