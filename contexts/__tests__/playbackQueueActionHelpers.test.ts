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
import { resetNativeQueueMutationLockForTests } from '../../utils/nativeQueueMutationLock';
import { toPlayableSongs } from '../../utils/playableSong';

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
    resetNativeQueueMutationLockForTests();
    await AsyncStorage.clear();
    jest.clearAllMocks();
    (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue(undefined);
    (TrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 12 });
  });

  test('uses active queue snapshot or playable library songs', () => {
    expect(getCurrentQueueSnapshot([songs[1]], songs)).toEqual([songs[1]]);
    expect(getCurrentQueueSnapshot([], [
      ...songs,
      { id: 'no-uri', title: 'No Uri', artist: 'A' },
      { id: 'blank-uri', title: 'Blank Uri', artist: 'A', uri: '   ' },
    ])).toEqual(songs);
  });

  test('persists requested song id only for library songs', async () => {
    await persistRequestedSongId(songs[0], songs);
    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBe('s1');

    await persistRequestedSongId({ id: 'external', title: 'External', artist: 'A', uri: 'file:///x.mp3' }, songs);
    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBeNull();
  });

  test('persists trimmed requested song id for matching library songs', async () => {
    await persistRequestedSongId(
      { id: ' s1 ', title: 'One', artist: 'A', uri: 'file:///s1.mp3' },
      [{ ...songs[0], id: 's1' }],
    );
    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBe('s1');

    await persistRequestedSongId({ id: '   ', title: 'Blank', artist: 'A', uri: 'file:///blank.mp3' }, songs);
    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBeNull();
  });

  test('applies playback queue state to refs and setters with copied arrays', () => {
    const queueContextRef = createSongRef();
    const baseQueueContextRef = createSongRef();
    const setPlaybackQueue = jest.fn();
    const setCurrentSong = jest.fn();
    const orderedQueue = [songs[1], songs[0]];

    applyPlaybackQueueState({
      queueContextRef,
      baseQueueContextRef,
      setPlaybackQueue,
      setCurrentSong,
      orderedQueue,
      baseQueue: songs,
      selectedSong: songs[1],
    });

    expect(queueContextRef.current).toEqual(orderedQueue);
    expect(queueContextRef.current).not.toBe(orderedQueue);
    expect(baseQueueContextRef.current).toEqual(songs);
    expect(baseQueueContextRef.current).not.toBe(songs);
    expect(setPlaybackQueue).toHaveBeenCalledWith(orderedQueue);
    expect(setCurrentSong).toHaveBeenCalledWith(songs[1]);
  });

  test('rebuilds native playback queue and resumes position', async () => {
    const nativeQueueRef = createSongRef([songs[2]]);

    await rebuildNativePlaybackQueue(toPlayableSongs(songs), nativeQueueRef, 12);

    expect(TrackPlayer.reset).toHaveBeenCalled();
    expect(TrackPlayer.add).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 's1' })]));
    expect(nativeQueueRef.current).toEqual(songs);
    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(12);
    expect(TrackPlayer.play).toHaveBeenCalled();
  });

  test('rebuildNativePlaybackQueue keeps previous native ref when add fails', async () => {
    const nativeQueueRef = createSongRef([songs[2]]);
    (TrackPlayer.add as jest.Mock).mockRejectedValueOnce(new Error('native add failed'));

    await expect(rebuildNativePlaybackQueue(toPlayableSongs(songs), nativeQueueRef)).rejects.toThrow('native add failed');

    expect(nativeQueueRef.current).toEqual([songs[2]]);
    expect(TrackPlayer.play).not.toHaveBeenCalled();
  });

  test('rebuildNativePlaybackQueue keeps previous native ref when reset fails', async () => {
    const nativeQueueRef = createSongRef([songs[2]]);
    (TrackPlayer.reset as jest.Mock).mockRejectedValueOnce(new Error('reset failed'));

    await expect(rebuildNativePlaybackQueue(toPlayableSongs(songs), nativeQueueRef)).rejects.toThrow('reset failed');

    expect(nativeQueueRef.current).toEqual([songs[2]]);
    expect(TrackPlayer.add).not.toHaveBeenCalled();
    expect(TrackPlayer.play).not.toHaveBeenCalled();
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

  test('runPlaySongQueueAction skips playback for songs without playable uri', async () => {
    const args = createQueueArgs();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const invalidSong: Song = { id: 'invalid', title: 'Invalid', artist: 'A', uri: '   ' };

    await runPlaySongQueueAction({ ...args, song: invalidSong, queue: [invalidSong] });

    expect(TrackPlayer.reset).not.toHaveBeenCalled();
    expect(TrackPlayer.play).not.toHaveBeenCalled();
    expect(args.setPlaybackQueue).not.toHaveBeenCalled();
    expect(args.setCurrentSong).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('[PlaybackQueue] Unable to build play-song queue plan.', { songId: 'invalid' });
  });

  test('runPlaySongQueueAction does not update UI state when native rebuild fails', async () => {
    const args = createQueueArgs();
    args.queueContextRef.current = [songs[0]];
    args.baseQueueContextRef.current = [songs[0]];
    (TrackPlayer.add as jest.Mock).mockRejectedValueOnce(new Error('native add failed'));

    await expect(runPlaySongQueueAction({ ...args, song: songs[1] })).rejects.toThrow('native add failed');

    expect(args.queueContextRef.current).toEqual([songs[0]]);
    expect(args.baseQueueContextRef.current).toEqual([songs[0]]);
    expect(args.setPlaybackQueue).not.toHaveBeenCalled();
    expect(args.setCurrentSong).not.toHaveBeenCalled();
    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBeNull();
  });



  test('runPlaySongQueueAction keeps logical base queue when reusing native queue', async () => {
    const args = createQueueArgs();
    args.nativeQueueRef.current = songs.slice();
    (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 's1' });

    await runPlaySongQueueAction({ ...args, song: songs[2], queue: songs });

    expect(TrackPlayer.skip).toHaveBeenCalledWith(2);
    expect(args.baseQueueContextRef.current.map(song => song.id)).toEqual(['s1', 's2', 's3']);
    expect(args.queueContextRef.current.map(song => song.id)).toEqual(['s3', 's1', 's2']);
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

  test('runShuffleQueueAction leaves UI state unchanged when native rebuild fails', async () => {
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

    expect(setShuffle).not.toHaveBeenCalled();
    expect(args.setPlaybackQueue).not.toHaveBeenCalled();
    expect(args.setCurrentSong).not.toHaveBeenCalled();
    expect(args.queueContextRef.current).toEqual(songs);
    expect(args.baseQueueContextRef.current).toEqual(songs);
    expect(args.nativeQueueRef.current).toEqual([songs[2]]);
  });
});
