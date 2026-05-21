import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer from 'react-native-track-player';
import {
  applyPlaybackQueueState,
  getCurrentQueueSnapshot,
  persistRequestedSongId,
  rebuildNativePlaybackQueue,
  runPlaySongQueueAction,
  runShuffleQueueAction,
} from '../playbackQueueActionHelpers';
import { StorageKeys, storage } from '../../utils/storage';
import type { Song } from '../../types/Song';

const songs: Song[] = [
  { id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' },
  { id: 's2', title: 'Two', artist: 'A', uri: 'file:///s2.mp3' },
  { id: 's3', title: 'Three', artist: 'A', uri: 'file:///s3.mp3' },
];

const createSongRef = (current: Song[] = []) => ({ current });
const createQueueArgs = () => ({
  songsRef: createSongRef(songs),
  queueContextRef: createSongRef(),
  baseQueueContextRef: createSongRef(),
  nativeQueueRef: createSongRef(),
  setPlaybackQueue: jest.fn(),
  setCurrentSong: jest.fn(),
});

describe('playbackQueueActionHelpers', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue(undefined);
    (TrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 12 });
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
    const nativeQueueRef = createSongRef([songs[2]]);

    await rebuildNativePlaybackQueue(songs, nativeQueueRef, 12);

    expect(TrackPlayer.reset).toHaveBeenCalled();
    expect(TrackPlayer.add).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 's1' })]));
    expect(nativeQueueRef.current).toEqual(songs);
    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(12);
    expect(TrackPlayer.play).toHaveBeenCalled();
  });

  test('rebuildNativePlaybackQueue clears stale native refs when add fails', async () => {
    const nativeQueueRef = createSongRef([songs[2]]);
    (TrackPlayer.add as jest.Mock).mockRejectedValueOnce(new Error('native add failed'));

    await expect(rebuildNativePlaybackQueue(songs, nativeQueueRef)).rejects.toThrow('native add failed');

    expect(nativeQueueRef.current).toEqual([]);
  });

  test('runs play-song queue action with full rebuild', async () => {
    const args = createQueueArgs();

    await runPlaySongQueueAction({ ...args, song: songs[1] });

    expect(args.setCurrentSong).toHaveBeenCalledWith(songs[1]);
    expect(args.setPlaybackQueue).toHaveBeenCalledWith([songs[1], songs[2], songs[0]]);
    expect(args.nativeQueueRef.current).toEqual([songs[1], songs[2], songs[0]]);
    expect(TrackPlayer.reset).toHaveBeenCalled();
    expect(TrackPlayer.play).toHaveBeenCalled();
    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBe('s2');
  });

  test('runs shuffle queue action and rebuilds native queue', async () => {
    const args = createQueueArgs();
    args.queueContextRef.current = songs.slice();
    args.baseQueueContextRef.current = songs.slice();
    const setShuffle = jest.fn();

    await runShuffleQueueAction({
      ...args,
      currentSongId: 's1',
      shuffle: false,
      setShuffle,
    });

    expect(setShuffle).toHaveBeenCalled();
    expect(args.setPlaybackQueue).toHaveBeenCalled();
    expect(TrackPlayer.reset).toHaveBeenCalled();
    expect(TrackPlayer.play).toHaveBeenCalled();
  });

  test('runShuffleQueueAction clears stale native refs when native rebuild fails', async () => {
    const args = createQueueArgs();
    args.queueContextRef.current = songs.slice();
    args.baseQueueContextRef.current = songs.slice();
    args.nativeQueueRef.current = [songs[2]];
    (TrackPlayer.add as jest.Mock).mockRejectedValueOnce(new Error('native add failed'));
    const setShuffle = jest.fn();

    await runShuffleQueueAction({
      ...args,
      currentSongId: 's1',
      shuffle: false,
      setShuffle,
    });

    expect(setShuffle).toHaveBeenCalled();
    expect(args.setPlaybackQueue).toHaveBeenCalled();
    expect(args.setCurrentSong).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }));
    expect(args.nativeQueueRef.current).toEqual([]);
  });
});
