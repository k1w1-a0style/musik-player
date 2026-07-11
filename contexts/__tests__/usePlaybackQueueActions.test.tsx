import React, { useRef, useState } from 'react';
import { Button, Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer from 'react-native-track-player';
import { usePlaybackQueueActions, persistRequestedSongId } from '../usePlaybackQueueActions';
import { StorageKeys, storage } from '../../utils/storage';
import type { Song } from '../../types/Song';
import { resetNativeQueueMutationLockForTests } from '../../utils/nativeQueueMutationLock';

const songs: Song[] = [
  { id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' },
  { id: 's2', title: 'Two', artist: 'A', uri: 'file:///s2.mp3' },
  { id: 's3', title: 'Three', artist: 'B', uri: 'file:///s3.mp3' },
];

type TrackPlayerMock = typeof TrackPlayer & {
  __reset: () => void;
  __getQueue: () => Array<{ id: string }>;
};

const trackPlayerMock = TrackPlayer as TrackPlayerMock;

const QueueActionsProbe = () => {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [shuffle, setShuffle] = useState(false);
  const songsRef = useRef<Song[]>(songs);
  const queueContextRef = useRef<Song[]>([]);
  const baseQueueContextRef = useRef<Song[]>([]);
  const nativeQueueRef = useRef<Song[]>([]);

  const { playSong, toggleShuffle } = usePlaybackQueueActions({
    songsRef,
    queueContextRef,
    baseQueueContextRef,
    nativeQueueRef,
    setPlaybackQueue: setQueue,
    setCurrentSong,
    currentSongId: currentSong?.id,
    shuffle,
    setShuffle,
  });

  return (
    <>
      <Text testID="current">{currentSong?.id ?? ''}</Text>
      <Text testID="queue">{queue.map(song => song.id).join(',')}</Text>
      <Text testID="shuffle">{String(shuffle)}</Text>
      <Button testID="play-s2" title="play" onPress={() => void playSong(songs[1])} />
      <Button testID="shuffle-button" title="shuffle" onPress={() => void toggleShuffle()} />
    </>
  );
};

describe('usePlaybackQueueActions', () => {
  beforeEach(async () => {
    resetNativeQueueMutationLockForTests();
    await AsyncStorage.clear();
    trackPlayerMock.__reset();
    jest.clearAllMocks();
  });

  test('persists the requested song only when it belongs to the library', async () => {
    await persistRequestedSongId(songs[0], songs);
    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBe('s1');

    await persistRequestedSongId({ id: 'other', title: 'Other', artist: 'A', uri: 'file:///other.mp3' }, songs);
    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBeNull();
  });

  test('plays a song by rebuilding the native queue', async () => {
    const { getByTestId } = render(<QueueActionsProbe />);

    await act(async () => {
      fireEvent.press(getByTestId('play-s2'));
    });

    await waitFor(() => expect(getByTestId('current').props.children).toBe('s2'));
    expect(getByTestId('queue').props.children).toBe('s1,s2,s3');
    expect(trackPlayerMock.__getQueue().map(track => track.id)).toEqual(['s1', 's2', 's3']);
    expect(TrackPlayer.reset).toHaveBeenCalled();
    expect(TrackPlayer.play).toHaveBeenCalled();
  });

  test('toggles shuffle for the current queue', async () => {
    const { getByTestId } = render(<QueueActionsProbe />);

    await act(async () => {
      fireEvent.press(getByTestId('play-s2'));
    });
    await waitFor(() => expect(getByTestId('current').props.children).toBe('s2'));

    await act(async () => {
      fireEvent.press(getByTestId('shuffle-button'));
    });

    expect(getByTestId('shuffle').props.children).toBe('true');
    expect(getByTestId('queue').props.children.split(',').sort()).toEqual(['s1', 's2', 's3']);
    expect(TrackPlayer.add).toHaveBeenCalled();
  });

  test('handles rapid shuffle double tap with latest shuffle state', async () => {
    const { getByTestId } = render(<QueueActionsProbe />);

    await act(async () => {
      fireEvent.press(getByTestId('play-s2'));
    });
    await waitFor(() => expect(getByTestId('current').props.children).toBe('s2'));

    await act(async () => {
      fireEvent.press(getByTestId('shuffle-button'));
      fireEvent.press(getByTestId('shuffle-button'));
    });

    await waitFor(() => expect(getByTestId('shuffle').props.children).toBe('false'));
    expect(getByTestId('current').props.children).toBe('s2');
    expect(getByTestId('queue').props.children).toBe('s1,s2,s3');
    expect(trackPlayerMock.__getQueue().map(track => track.id)).toEqual(['s1', 's2', 's3']);
  });
});
