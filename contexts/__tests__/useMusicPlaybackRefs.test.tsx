import React from 'react';
import { Button, Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMusicPlaybackRefs, persistCurrentSongIdForLibrary } from '../useMusicPlaybackRefs';
import { StorageKeys, storage } from '../../utils/storage';
import type { Song } from '../../types/Song';

const songs: Song[] = [{ id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' }];

const RefsProbe = ({ currentSongs = songs }: { currentSongs?: Song[] }) => {
  const { songsRef, queueContextRef, baseQueueContextRef, nativeQueueRef, persistCurrentSongId } =
    useMusicPlaybackRefs(currentSongs);

  return (
    <>
      <Text testID="songs-count">{songsRef.current.length}</Text>
      <Text testID="queue-count">{queueContextRef.current.length}</Text>
      <Text testID="base-count">{baseQueueContextRef.current.length}</Text>
      <Text testID="native-count">{nativeQueueRef.current.length}</Text>
      <Button testID="persist" title="persist" onPress={() => void persistCurrentSongId(currentSongs[0])} />
    </>
  );
};

describe('useMusicPlaybackRefs', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  test('persists current song id only for library songs', async () => {
    await persistCurrentSongIdForLibrary(songs[0], songs);
    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBe('s1');

    await persistCurrentSongIdForLibrary({ id: 'missing', title: 'Missing', artist: 'A' }, songs);
    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBeNull();

    await persistCurrentSongIdForLibrary(null, songs);
    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBeNull();
  });

  test('exposes playback refs and persist callback', async () => {
    const { getByTestId } = render(<RefsProbe />);

    expect(getByTestId('songs-count').props.children).toBe(1);
    expect(getByTestId('queue-count').props.children).toBe(0);
    expect(getByTestId('base-count').props.children).toBe(0);
    expect(getByTestId('native-count').props.children).toBe(0);

    await act(async () => {
      fireEvent.press(getByTestId('persist'));
    });

    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBe('s1');
  });
});
