import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer from 'react-native-track-player';
import {
  applyPlaybackQueueState,
  getCurrentQueueSnapshot,
  persistRequestedSongId,
  rebuildNativePlaybackQueue,
  runInsertSongQueueAction,
  runPlaySongQueueAction,
  runShuffleQueueAction,
} from '../playbackQueueActionHelpers';
import { StorageKeys, storage } from '../../utils/storage';
import type { Song } from '../../types/Song';
import {
  getNativeQueueReplacementVersion,
  resetNativeQueueMutationLockForTests,
  runExclusiveNativeQueueReplacement,
} from '../../utils/nativeQueueMutationLock';
import { toPlayableSongs } from '../../utils/playableSong';

const songs: Song[] = [
  { id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' },
  { id: 's2', title: 'Two', artist: 'A', uri: 'file:///s2.mp3' },
  { id: 's3', title: 'Three', artist: 'A', uri: 'file:///s3.mp3' },
];
const extraSong: Song = { id: 's4', title: 'Four', artist: 'A', uri: 'file:///s4.mp3' };

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const createSongRef = (current: Song[] = []) => ({ current });
const createQueueArgs = () => ({
  songsRef: createSongRef(songs),
  queueContextRef: createSongRef(),
  baseQueueContextRef: createSongRef(),
  nativeQueueRef: createSongRef(),
  setPlaybackQueue: jest.fn(),
  setCurrentSong: jest.fn(),
  shuffle: false,
  setShuffle: jest.fn(),
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

  test('rebuildNativePlaybackQueue clears native ref when add fails after reset', async () => {
    const nativeQueueRef = createSongRef([songs[2]]);
    (TrackPlayer.add as jest.Mock).mockRejectedValueOnce(new Error('native add failed'));

    await expect(rebuildNativePlaybackQueue(toPlayableSongs(songs), nativeQueueRef)).rejects.toThrow('native add failed');

    expect(nativeQueueRef.current).toEqual([]);
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

  test('rebuildNativePlaybackQueue clears native ref when seekTo fails after add', async () => {
    const nativeQueueRef = createSongRef([songs[0], songs[1]]);
    const rebuiltQueue = toPlayableSongs([songs[1], songs[0]]);
    (TrackPlayer.seekTo as jest.Mock).mockRejectedValueOnce(new Error('seek failed'));

    await expect(rebuildNativePlaybackQueue(rebuiltQueue, nativeQueueRef, 12)).rejects.toThrow('seek failed');

    expect(TrackPlayer.add).toHaveBeenCalledWith([
      expect.objectContaining({ id: 's2' }),
      expect.objectContaining({ id: 's1' }),
    ]);
    expect(nativeQueueRef.current).toEqual([]);
    expect(TrackPlayer.play).not.toHaveBeenCalled();
  });

  test('rebuildNativePlaybackQueue clears native ref when play fails after add', async () => {
    const nativeQueueRef = createSongRef([songs[0], songs[1]]);
    const rebuiltQueue = toPlayableSongs([songs[1], songs[0]]);
    (TrackPlayer.play as jest.Mock).mockRejectedValueOnce(new Error('play failed'));

    await expect(rebuildNativePlaybackQueue(rebuiltQueue, nativeQueueRef)).rejects.toThrow('play failed');

    expect(TrackPlayer.add).toHaveBeenCalledWith([
      expect.objectContaining({ id: 's2' }),
      expect.objectContaining({ id: 's1' }),
    ]);
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
    expect(args.nativeQueueRef.current).toEqual([]);
    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBeNull();
  });



  test('runPlaySongQueueAction does not leave native ref ahead of UI when play fails after add', async () => {
    const args = createQueueArgs();
    args.queueContextRef.current = [songs[0], songs[1]];
    args.baseQueueContextRef.current = [songs[0], songs[1]];
    (TrackPlayer.play as jest.Mock).mockRejectedValueOnce(new Error('play failed'));

    await expect(runPlaySongQueueAction({ ...args, song: songs[1] })).rejects.toThrow('play failed');

    expect(args.queueContextRef.current).toEqual([songs[0], songs[1]]);
    expect(args.baseQueueContextRef.current).toEqual([songs[0], songs[1]]);
    expect(args.setPlaybackQueue).not.toHaveBeenCalled();
    expect(args.setCurrentSong).not.toHaveBeenCalled();
    expect(args.nativeQueueRef.current).toEqual([]);
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


  test('runInsertSongQueueAction inserts a song directly after the current song without restarting playback', async () => {
    const args = createQueueArgs();
    args.queueContextRef.current = [songs[0], songs[2]];
    args.baseQueueContextRef.current = [songs[0], songs[2]];
    args.nativeQueueRef.current = [songs[0], songs[2]];
    (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 's1' });

    await runInsertSongQueueAction({ ...args, song: songs[1], currentSongId: 's1', position: 'next' });

    expect(TrackPlayer.add).toHaveBeenCalledWith(expect.objectContaining({ id: 's2' }), 1);
    expect(TrackPlayer.reset).not.toHaveBeenCalled();
    expect(TrackPlayer.play).not.toHaveBeenCalled();
    expect(args.setCurrentSong).toHaveBeenCalledWith(songs[0]);
    expect(args.queueContextRef.current.map(song => song.id)).toEqual(['s1', 's2', 's3']);
    expect(args.nativeQueueRef.current.map(song => song.id)).toEqual(['s1', 's2', 's3']);
  });

  test('runInsertSongQueueAction appends a song at the end without changing the current song', async () => {
    const args = createQueueArgs();
    args.queueContextRef.current = [songs[0], songs[1]];
    args.baseQueueContextRef.current = [songs[0], songs[1]];
    args.nativeQueueRef.current = [songs[0], songs[1]];
    (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 's1' });

    await runInsertSongQueueAction({ ...args, song: songs[2], currentSongId: 's1', position: 'end' });

    expect(TrackPlayer.add).toHaveBeenCalledWith(expect.objectContaining({ id: 's3' }), 2);
    expect(TrackPlayer.reset).not.toHaveBeenCalled();
    expect(TrackPlayer.play).not.toHaveBeenCalled();
    expect(args.setCurrentSong).toHaveBeenCalledWith(songs[0]);
    expect(args.queueContextRef.current.map(song => song.id)).toEqual(['s1', 's2', 's3']);
  });

  test('runInsertSongQueueAction uses the native queue index when UI queue is rotated', async () => {
    const args = createQueueArgs();
    args.nativeQueueRef.current = songs.slice();
    args.queueContextRef.current = [songs[2], songs[0], songs[1]];
    args.baseQueueContextRef.current = songs.slice();
    (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 's3' });

    await runInsertSongQueueAction({ ...args, song: extraSong, currentSongId: 's3', position: 'next' });

    expect(TrackPlayer.add).toHaveBeenCalledWith(expect.objectContaining({ id: 's4' }), 3);
    expect(TrackPlayer.reset).not.toHaveBeenCalled();
    expect(TrackPlayer.play).not.toHaveBeenCalled();
    expect(args.setCurrentSong).toHaveBeenCalledWith(songs[2]);
    expect(args.nativeQueueRef.current.map(song => song.id)).toEqual(['s1', 's2', 's3', 's4']);
    expect(args.queueContextRef.current.map(song => song.id)).toEqual(['s1', 's2', 's3', 's4']);
  });

  test('runInsertSongQueueAction appends when the active track is missing from the native queue', async () => {
    const args = createQueueArgs();
    args.nativeQueueRef.current = [songs[0], songs[1]];
    args.queueContextRef.current = [songs[2], songs[0], songs[1]];
    (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 's3' });

    await runInsertSongQueueAction({ ...args, song: extraSong, currentSongId: 's3', position: 'next' });

    expect(TrackPlayer.add).toHaveBeenCalledWith(expect.objectContaining({ id: 's4' }), 2);
    expect(args.nativeQueueRef.current.map(song => song.id)).toEqual(['s1', 's2', 's4']);
    expect(args.queueContextRef.current.map(song => song.id)).toEqual(['s1', 's2', 's4']);
  });

  test('runInsertSongQueueAction disables shuffle instead of overwriting base queue with a shuffled queue', async () => {
    const args = createQueueArgs();
    const shuffleRef = { current: true };
    args.shuffle = true;
    args.nativeQueueRef.current = songs.slice();
    args.queueContextRef.current = [songs[2], songs[0], songs[1]];
    args.baseQueueContextRef.current = songs.slice();
    (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 's3' });

    await runInsertSongQueueAction({ ...args, song: extraSong, currentSongId: 's3', position: 'next', shuffleRef });

    expect(shuffleRef.current).toBe(false);
    expect(args.setShuffle).toHaveBeenCalledWith(false);
    expect(args.baseQueueContextRef.current.map(song => song.id)).toEqual(['s1', 's2', 's3', 's4']);
    expect(args.queueContextRef.current.map(song => song.id)).toEqual(['s1', 's2', 's3', 's4']);
  });

  test('runInsertSongQueueAction avoids duplicate song ids', async () => {
    const args = createQueueArgs();
    args.queueContextRef.current = [songs[0], songs[1]];

    await runInsertSongQueueAction({ ...args, song: songs[1], currentSongId: 's1', position: 'next' });

    expect(TrackPlayer.add).not.toHaveBeenCalled();
    expect(args.setPlaybackQueue).not.toHaveBeenCalled();
    expect(args.queueContextRef.current.map(song => song.id)).toEqual(['s1', 's2']);
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

  test('runShuffleQueueAction commits native and React state consistently after successful rebuild', async () => {
    const args = createQueueArgs();
    args.queueContextRef.current = songs.slice();
    args.baseQueueContextRef.current = songs.slice();
    args.nativeQueueRef.current = songs.slice();
    (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 's2' });
    const setShuffle = jest.fn();

    await runShuffleQueueAction({
      ...args,
      currentSongId: 's2',
      shuffle: false,
      setShuffle,
    });

    const finalQueue = args.setPlaybackQueue.mock.calls[0][0] as Song[];
    expect(TrackPlayer.reset).toHaveBeenCalled();
    expect(TrackPlayer.add).toHaveBeenCalled();
    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(12);
    expect(TrackPlayer.play).toHaveBeenCalled();
    expect((TrackPlayer.reset as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (TrackPlayer.add as jest.Mock).mock.invocationCallOrder[0],
    );
    expect((TrackPlayer.add as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (TrackPlayer.seekTo as jest.Mock).mock.invocationCallOrder[0],
    );
    expect((TrackPlayer.seekTo as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (TrackPlayer.play as jest.Mock).mock.invocationCallOrder[0],
    );
    expect(args.nativeQueueRef.current).toEqual(finalQueue);
    expect(args.queueContextRef.current).toEqual(finalQueue);
    expect(args.baseQueueContextRef.current).toEqual(songs);
    expect(finalQueue[0]).toEqual(songs[1]);
    expect(args.setCurrentSong).toHaveBeenCalledWith(songs[1]);
    expect((TrackPlayer.play as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      setShuffle.mock.invocationCallOrder[0],
    );
    expect(setShuffle).toHaveBeenCalledWith(true);
  });

  test('runShuffleQueueAction builds its plan from refs read inside the replacement context', async () => {
    const args = createQueueArgs();
    const oldQueue = [songs[0], songs[1]];
    const latestQueue = [songs[2], songs[1]];
    args.queueContextRef.current = oldQueue.slice();
    args.baseQueueContextRef.current = oldQueue.slice();
    let resolveActiveTrack: (track: { id: string }) => void = () => undefined;
    (TrackPlayer.getActiveTrack as jest.Mock).mockImplementationOnce(() => new Promise(resolve => {
      resolveActiveTrack = resolve;
    }));
    const setShuffle = jest.fn();

    const shufflePromise = runShuffleQueueAction({
      ...args,
      currentSongId: 's1',
      shuffle: false,
      setShuffle,
    });
    await flushMicrotasks();

    args.queueContextRef.current = latestQueue.slice();
    args.baseQueueContextRef.current = latestQueue.slice();
    resolveActiveTrack({ id: 's3' });
    await shufflePromise;

    expect(args.setPlaybackQueue).toHaveBeenCalledTimes(1);
    const finalQueue = args.setPlaybackQueue.mock.calls[0][0] as Song[];
    expect(finalQueue.map(song => song.id).sort()).toEqual(['s2', 's3']);
    expect(finalQueue.map(song => song.id)).not.toEqual(oldQueue.map(song => song.id));
    expect(args.nativeQueueRef.current).toEqual(finalQueue);
    expect(args.queueContextRef.current).toEqual(finalQueue);
    expect(args.baseQueueContextRef.current).toEqual(latestQueue);
    expect(args.setCurrentSong).toHaveBeenCalledWith(songs[2]);
  });

  test('runShuffleQueueAction commits nothing stale when superseded during native add', async () => {
    const args = createQueueArgs();
    args.queueContextRef.current = songs.slice();
    args.baseQueueContextRef.current = songs.slice();
    args.nativeQueueRef.current = songs.slice();
    (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 's2' });
    let resolveAdd: () => void = () => undefined;
    (TrackPlayer.add as jest.Mock).mockImplementationOnce(() => new Promise<void>(resolve => {
      resolveAdd = resolve;
    }));
    const setShuffle = jest.fn();

    const shufflePromise = runShuffleQueueAction({
      ...args,
      currentSongId: 's2',
      shuffle: false,
      setShuffle,
    });
    await flushMicrotasks();
    expect(TrackPlayer.add).toHaveBeenCalled();

    const newerNativeQueue = [songs[2]];
    const newerReplacement = runExclusiveNativeQueueReplacement(async ({ isCurrent }) => {
      expect(isCurrent()).toBe(true);
      args.nativeQueueRef.current = newerNativeQueue.slice();
    });
    resolveAdd();
    await Promise.all([shufflePromise, newerReplacement]);

    expect(args.setPlaybackQueue).not.toHaveBeenCalled();
    expect(args.setCurrentSong).not.toHaveBeenCalled();
    expect(setShuffle).not.toHaveBeenCalled();
    expect(args.queueContextRef.current).toEqual(songs);
    expect(args.baseQueueContextRef.current).toEqual(songs);
    expect(args.nativeQueueRef.current).toEqual(newerNativeQueue);
  });

  test('runShuffleQueueAction leaves UI unchanged and native ref empty when seek fails after add', async () => {
    const args = createQueueArgs();
    args.queueContextRef.current = songs.slice();
    args.baseQueueContextRef.current = songs.slice();
    args.nativeQueueRef.current = songs.slice();
    (TrackPlayer.seekTo as jest.Mock).mockRejectedValueOnce(new Error('seek failed'));
    const setShuffle = jest.fn();

    await runShuffleQueueAction({
      ...args,
      currentSongId: 's1',
      shuffle: false,
      setShuffle,
    });

    expect(args.nativeQueueRef.current).toEqual([]);
    expect(args.queueContextRef.current).toEqual(songs);
    expect(args.baseQueueContextRef.current).toEqual(songs);
    expect(args.setPlaybackQueue).not.toHaveBeenCalled();
    expect(args.setCurrentSong).not.toHaveBeenCalled();
    expect(setShuffle).not.toHaveBeenCalled();
  });

  test('runShuffleQueueAction uses exactly one native replacement intent', async () => {
    const args = createQueueArgs();
    args.queueContextRef.current = songs.slice();
    args.baseQueueContextRef.current = songs.slice();
    const setShuffle = jest.fn();

    expect(getNativeQueueReplacementVersion()).toBe(0);
    await runShuffleQueueAction({
      ...args,
      currentSongId: 's1',
      shuffle: false,
      setShuffle,
    });

    expect(getNativeQueueReplacementVersion()).toBe(1);
    expect(setShuffle).toHaveBeenCalledWith(true);
  });

  test('runShuffleQueueAction leaves UI and native ref unchanged when reset fails', async () => {
    const args = createQueueArgs();
    args.queueContextRef.current = songs.slice();
    args.baseQueueContextRef.current = songs.slice();
    args.nativeQueueRef.current = [songs[2]];
    (TrackPlayer.reset as jest.Mock).mockRejectedValueOnce(new Error('reset failed'));
    const setShuffle = jest.fn();

    await runShuffleQueueAction({
      ...args,
      currentSongId: 's1',
      shuffle: false,
      setShuffle,
    });

    expect(args.nativeQueueRef.current).toEqual([songs[2]]);
    expect(args.queueContextRef.current).toEqual(songs);
    expect(args.baseQueueContextRef.current).toEqual(songs);
    expect(args.setPlaybackQueue).not.toHaveBeenCalled();
    expect(args.setCurrentSong).not.toHaveBeenCalled();
    expect(setShuffle).not.toHaveBeenCalled();
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
    expect(args.nativeQueueRef.current).toEqual([]);
  });

  test('runShuffleQueueAction leaves UI state unchanged and clears native ref when playback start fails', async () => {
    const args = createQueueArgs();
    args.queueContextRef.current = songs.slice();
    args.baseQueueContextRef.current = songs.slice();
    args.nativeQueueRef.current = songs.slice();
    (TrackPlayer.play as jest.Mock).mockRejectedValueOnce(new Error('play failed'));
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
    expect(args.nativeQueueRef.current).toEqual([]);
  });

  test('rebuildNativePlaybackQueue resets before adding multiple songs and then starts playback', async () => {
    const nativeQueueRef = createSongRef();

    await rebuildNativePlaybackQueue(toPlayableSongs(songs), nativeQueueRef);

    expect(TrackPlayer.reset).toHaveBeenCalledTimes(1);
    expect(TrackPlayer.add).toHaveBeenCalledWith([
      expect.objectContaining({ id: 's1' }),
      expect.objectContaining({ id: 's2' }),
      expect.objectContaining({ id: 's3' }),
    ]);
    expect((TrackPlayer.reset as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (TrackPlayer.add as jest.Mock).mock.invocationCallOrder[0],
    );
    expect((TrackPlayer.add as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (TrackPlayer.play as jest.Mock).mock.invocationCallOrder[0],
    );
    expect(nativeQueueRef.current.map(song => song.id)).toEqual(['s1', 's2', 's3']);
  });

  test('rebuildNativePlaybackQueue clears an empty queue without adding or starting playback', async () => {
    const nativeQueueRef = createSongRef([songs[0]]);

    await rebuildNativePlaybackQueue([], nativeQueueRef);

    expect(TrackPlayer.reset).toHaveBeenCalledTimes(1);
    expect(TrackPlayer.add).not.toHaveBeenCalled();
    expect(TrackPlayer.play).not.toHaveBeenCalled();
    expect(nativeQueueRef.current).toEqual([]);
  });

  test('runShuffleQueueAction keeps the active song selected after rebuilding shuffled queue', async () => {
    const args = createQueueArgs();
    args.queueContextRef.current = songs.slice();
    args.baseQueueContextRef.current = songs.slice();
    args.nativeQueueRef.current = songs.slice();
    (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 's2' });
    const setShuffle = jest.fn();

    await runShuffleQueueAction({
      ...args,
      currentSongId: 's1',
      shuffle: false,
      setShuffle,
    });

    expect(args.setCurrentSong).toHaveBeenCalledWith(songs[1]);
    const rebuiltQueue = args.setPlaybackQueue.mock.calls[0][0] as Song[];
    expect(rebuiltQueue[0].id).toBe('s2');
    expect(args.nativeQueueRef.current[0].id).toBe('s2');
  });

});
