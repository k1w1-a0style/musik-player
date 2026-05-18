import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer from 'react-native-track-player';
import {
  applyPlaybackQueueState,
  getCurrentQueueSnapshot,
  persistRequestedSongId,
  rebuildNativePlaybackQueue,
} from '../playbackQueueActionHelpers';
import { StorageKeys, storage } from '../../utils/storage';
import type { Song } from '../../types/Song';

const songs: Song[] = [
  { id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' },
  { id: 's2', title: 'Two', artist: 'A', uri: 'file:///s2.mp3' },
];

const createSongRef = (current: Song[] = []) => ({ current });

describe('playbackQueueActionHelpers', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  test('uses active queue snapshot or playable library songs', () => {
    expect(getCurrentQueueSnapshot([songs[1]], songs)).toEqual([songs[1]]);
    expect(getCurrentQueueSnapshot([], [...songs, { id: 'no-uri', title: 'No Uri', artist: 'A' }])).toEqual(songs);
  });

  test('persists requested song id only for library songs', async () => {
    await persistRequestedSongId(songs[0], songs);
    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBe('s1');

    await persistRequestedSongId({ id: 'external', title: 'External', artist: 'A', uri: 'file:///x.mp3' }, songs);
    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBeNull();
  });

  test('applies playback queue state to refs and setters', () => {
    const queueContextRef = createSongRef();
    const baseQueueContextRef = createSongRef();
    const setPlaybackQueue = jest.fn();
    const setCurrentSong = jest.fn();

    applyPlaybackQueueState({
      queueContextRef,
      baseQueueContextRef,
      setPlaybackQueue,
      setCurrentSong,
      orderedQueue: [songs[1], songs[0]],
      baseQueue: songs,
      selectedSong: songs[1],
    });

    expect(queueContextRef.current).toEqual([songs[1], songs[0]]);
    expect(baseQueueContextRef.current).toEqual(songs);
    expect(setPlaybackQueue).toHaveBeenCalledWith([songs[1], songs[0]]);
    expect(setCurrentSong).toHaveBeenCalledWith(songs[1]);
  });

  test('rebuilds native playback queue and resumes position', async () => {
    const nativeQueueRef = createSongRef();

    await rebuildNativePlaybackQueue(songs, nativeQueueRef, 12);

    expect(TrackPlayer.reset).toHaveBeenCalled();
    expect(TrackPlayer.add).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 's1' })]));
    expect(nativeQueueRef.current).toEqual(songs);
    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(12);
    expect(TrackPlayer.play).toHaveBeenCalled();
  });
});
