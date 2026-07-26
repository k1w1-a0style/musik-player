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

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(promiseResolve => { resolve = promiseResolve; });
  return { promise, resolve };
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

  test('rebuildNativePlaybackQueue retains truthful native ref when seekTo fails after add', async () => {
    const nativeQueueRef = createSongRef([songs[0], songs[1]]);
    const rebuiltQueue = toPlayableSongs([songs[1], songs[0]]);
    (TrackPlayer.seekTo as jest.Mock).mockRejectedValueOnce(new Error('seek failed'));

    await expect(rebuildNativePlaybackQueue(rebuiltQueue, nativeQueueRef, 12)).rejects.toThrow('seek failed');

    expect(TrackPlayer.add).toHaveBeenCalledWith([
      expect.objectContaining({ id: 's2' }),
      expect.objectContaining({ id: 's1' }),
    ]);
    expect(nativeQueueRef.current).toEqual(rebuiltQueue);
    expect(TrackPlayer.play).not.toHaveBeenCalled();
  });

  test('rebuildNativePlaybackQueue retains truthful native ref when play fails after add', async () => {
    const nativeQueueRef = createSongRef([songs[0], songs[1]]);
    const rebuiltQueue = toPlayableSongs([songs[1], songs[0]]);
    (TrackPlayer.play as jest.Mock).mockRejectedValueOnce(new Error('play failed'));

    await expect(rebuildNativePlaybackQueue(rebuiltQueue, nativeQueueRef)).rejects.toThrow('play failed');

    expect(TrackPlayer.add).toHaveBeenCalledWith([
      expect.objectContaining({ id: 's2' }),
      expect.objectContaining({ id: 's1' }),
    ]);
    expect(nativeQueueRef.current).toEqual(rebuiltQueue);
  });

  test('runs play-song queue action with full rebuild', async () => {
    const args = createQueueArgs();

    await runPlaySongQueueAction({ ...args, song: songs[1] });

    expect(args.setCurrentSong).toHaveBeenCalledWith(songs[1]);
    expect(args.setPlaybackQueue).toHaveBeenCalledWith([songs[0], songs[1], songs[2]]);
    expect(args.nativeQueueRef.current).toEqual([songs[0], songs[1], songs[2]]);
    expect(TrackPlayer.skip).toHaveBeenCalledWith(1);
    expect(TrackPlayer.reset).toHaveBeenCalled();
    expect(TrackPlayer.play).toHaveBeenCalled();
    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBe('s2');
  });

  test('runPlaySongQueueAction builds its plan from the native ref inside the mutation chain', async () => {
    const args = createQueueArgs();
    args.nativeQueueRef.current = [];
    const blockerStarted = createDeferred<void>();
    const releaseBlocker = createDeferred<void>();
    const blocker = runExclusiveNativeQueueReplacement(async () => {
      blockerStarted.resolve();
      await releaseBlocker.promise;
      args.nativeQueueRef.current = songs.slice();
    });
    await blockerStarted.promise;

    const playPromise = runPlaySongQueueAction({ ...args, song: songs[2], queue: songs });
    releaseBlocker.resolve();
    await Promise.all([blocker, playPromise]);

    expect(TrackPlayer.reset).not.toHaveBeenCalled();
    expect(TrackPlayer.skip).toHaveBeenCalledWith(2);
    expect(args.nativeQueueRef.current).toEqual(songs);
    expect(args.setCurrentSong).toHaveBeenCalledWith(songs[2]);
  });

  test('runPlaySongQueueAction finishes its state commit before a newer replacement starts', async () => {
    const args = createQueueArgs();
    let resolveAdd: () => void = () => undefined;
    let signalAddStarted: () => void = () => undefined;
    const addStarted = new Promise<void>(resolve => {
      signalAddStarted = resolve;
    });
    (TrackPlayer.add as jest.Mock).mockImplementationOnce(() => new Promise<void>(resolve => {
      resolveAdd = resolve;
      signalAddStarted();
    }));

    const playPromise = runPlaySongQueueAction({ ...args, song: songs[1] });
    await addStarted;
    expect(TrackPlayer.add).toHaveBeenCalled();
    (TrackPlayer.skip as jest.Mock).mockResolvedValueOnce(undefined);

    let newerReplacementObservedCommittedState = false;
    const newerReplacement = runExclusiveNativeQueueReplacement(async ({ isCurrent }) => {
      expect(isCurrent()).toBe(true);
      expect(args.nativeQueueRef.current).toEqual(songs);
      expect(args.queueContextRef.current).toEqual(songs);
      newerReplacementObservedCommittedState = true;
    });
    resolveAdd();
    await Promise.all([playPromise, newerReplacement]);

    expect(newerReplacementObservedCommittedState).toBe(true);
    expect(args.setPlaybackQueue).toHaveBeenCalledWith(songs);
    expect(args.setCurrentSong).toHaveBeenCalledWith(songs[1]);
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

  test('runPlaySongQueueAction reconciles every logical representation when add fails after reset', async () => {
    const args = createQueueArgs();
    args.queueContextRef.current = [songs[0]];
    args.baseQueueContextRef.current = [songs[0]];
    (TrackPlayer.add as jest.Mock).mockRejectedValueOnce(new Error('native add failed'));

    await expect(runPlaySongQueueAction({ ...args, song: songs[1] })).rejects.toThrow('native add failed');

    expect(args.queueContextRef.current).toEqual([]);
    expect(args.baseQueueContextRef.current).toEqual([]);
    expect(args.setPlaybackQueue).toHaveBeenCalledWith([]);
    expect(args.setCurrentSong).toHaveBeenCalledWith(null);
    expect(args.nativeQueueRef.current).toEqual([]);
    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBeNull();
  });



  test('runPlaySongQueueAction reconciles queue, active song, and persistence when play fails after add', async () => {
    const args = createQueueArgs();
    args.queueContextRef.current = [songs[0], songs[1]];
    args.baseQueueContextRef.current = [songs[0], songs[1]];
    (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 's1' });
    (TrackPlayer.play as jest.Mock).mockRejectedValueOnce(new Error('play failed'));

    await expect(runPlaySongQueueAction({ ...args, song: songs[1] })).rejects.toThrow('play failed');

    expect(args.queueContextRef.current).toEqual(songs);
    expect(args.baseQueueContextRef.current).toEqual(songs);
    expect(args.setPlaybackQueue).toHaveBeenCalledWith(songs);
    expect(args.setCurrentSong).toHaveBeenCalledWith(songs[0]);
    expect(args.nativeQueueRef.current).toEqual(songs);
    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBe('s1');
  });

  test('runPlaySongQueueAction keeps logical base queue when reusing native queue', async () => {
    const args = createQueueArgs();
    args.nativeQueueRef.current = songs.slice();
    (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 's1' });
    (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 's1' });

    await runPlaySongQueueAction({ ...args, song: songs[2], queue: songs });

    expect(TrackPlayer.skip).toHaveBeenCalledWith(2);
    expect(args.baseQueueContextRef.current.map(song => song.id)).toEqual(['s1', 's2', 's3']);
    expect(args.queueContextRef.current.map(song => song.id)).toEqual(['s1', 's2', 's3']);
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

  test('runInsertSongQueueAction inserts into an empty playback queue instead of treating the library as active queue', async () => {
    const args = createQueueArgs();
    args.queueContextRef.current = [];
    args.nativeQueueRef.current = [];
    (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue(undefined);

    await runInsertSongQueueAction({ ...args, song: songs[0], position: 'end' });

    expect(TrackPlayer.add).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }), 0);
    expect(TrackPlayer.reset).not.toHaveBeenCalled();
    expect(TrackPlayer.play).not.toHaveBeenCalled();
    expect(args.setCurrentSong).not.toHaveBeenCalled();
    expect(args.nativeQueueRef.current.map(song => song.id)).toEqual(['s1']);
    expect(args.queueContextRef.current.map(song => song.id)).toEqual(['s1']);
    expect(args.baseQueueContextRef.current.map(song => song.id)).toEqual(['s1']);
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

  test('runInsertSongQueueAction reconciles a native insert that rejects after applying its side effect', async () => {
    const args = createQueueArgs();
    args.queueContextRef.current = [songs[0], songs[2]];
    args.baseQueueContextRef.current = [songs[0], songs[2]];
    args.nativeQueueRef.current = [songs[0], songs[2]];
    const nativeQueue = [songs[0], songs[2]];
    (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 's1' });
    (TrackPlayer.add as jest.Mock).mockImplementationOnce(async (track: Song, index: number) => {
      nativeQueue.splice(index, 0, track);
      throw new Error('bridge acknowledgement failed');
    });
    (TrackPlayer.getQueue as jest.Mock).mockImplementation(async () => nativeQueue);

    await expect(runInsertSongQueueAction({ ...args, song: songs[1], currentSongId: 's1', position: 'next' }))
      .resolves.toBe(false);

    expect(args.nativeQueueRef.current.map(item => item.id)).toEqual(['s1', 's2', 's3']);
    expect(args.queueContextRef.current).toEqual(args.nativeQueueRef.current);
    expect(args.baseQueueContextRef.current).toEqual(args.nativeQueueRef.current);
    expect(args.setPlaybackQueue).toHaveBeenCalledWith(args.nativeQueueRef.current);
    expect(args.setCurrentSong).toHaveBeenCalledWith(songs[0]);
  });

  test('runInsertSongQueueAction does not add to shuffled base queue when native add rejects without side effect', async () => {
    const args = createQueueArgs();
    const shuffledQueue = [songs[2], songs[0]];
    const baseQueue = [songs[0], songs[2]];
    const shuffleRef = { current: true };
    args.queueContextRef.current = shuffledQueue.slice();
    args.baseQueueContextRef.current = baseQueue.slice();
    args.nativeQueueRef.current = shuffledQueue.slice();
    (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 's3' });
    (TrackPlayer.add as jest.Mock).mockRejectedValueOnce(new Error('add rejected'));
    (TrackPlayer.getQueue as jest.Mock).mockResolvedValue(shuffledQueue);

    await expect(runInsertSongQueueAction({
      ...args, song: songs[1], currentSongId: 's3', position: 'next', shuffle: true, shuffleRef,
    })).resolves.toBe(false);

    expect(args.nativeQueueRef.current).toEqual(shuffledQueue);
    expect(args.queueContextRef.current).toEqual(shuffledQueue);
    expect(args.baseQueueContextRef.current).toEqual(baseQueue);
    expect(args.baseQueueContextRef.current).not.toContainEqual(songs[1]);
    expect(shuffleRef.current).toBe(true);
    expect(args.setShuffle).toHaveBeenCalledWith(true);
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
    const nativeIsShuffled = args.nativeQueueRef.current.some((song, index) => song.id !== songs[index]?.id);
    expect(setShuffle).toHaveBeenCalledWith(nativeIsShuffled);
  });

  test('runShuffleQueueAction builds its plan from refs read inside the replacement context', async () => {
    const args = createQueueArgs();
    const oldQueue = [songs[0], songs[1]];
    const latestQueue = [songs[2], songs[1]];
    args.queueContextRef.current = oldQueue.slice();
    args.baseQueueContextRef.current = oldQueue.slice();
    const activeTrackStarted = createDeferred<void>();
    const activeTrackResult = createDeferred<{ id: string }>();
    (TrackPlayer.getActiveTrack as jest.Mock).mockImplementationOnce(() => new Promise(resolve => {
      activeTrackStarted.resolve();
      void activeTrackResult.promise.then(resolve);
    }));
    const setShuffle = jest.fn();

    const shufflePromise = runShuffleQueueAction({
      ...args,
      currentSongId: 's1',
      shuffle: false,
      setShuffle,
    });
    await activeTrackStarted.promise;

    args.queueContextRef.current = latestQueue.slice();
    args.baseQueueContextRef.current = latestQueue.slice();
    activeTrackResult.resolve({ id: 's3' });
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

  test('runShuffleQueueAction commits before a newer replacement starts', async () => {
    const args = createQueueArgs();
    args.queueContextRef.current = songs.slice();
    args.baseQueueContextRef.current = songs.slice();
    args.nativeQueueRef.current = songs.slice();
    (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 's2' });
    const addStarted = createDeferred<void>();
    const releaseAdd = createDeferred<void>();
    (TrackPlayer.add as jest.Mock).mockImplementationOnce(() => new Promise<void>(resolve => {
      addStarted.resolve();
      void releaseAdd.promise.then(resolve);
    }));
    const setShuffle = jest.fn();

    const shufflePromise = runShuffleQueueAction({
      ...args,
      currentSongId: 's2',
      shuffle: false,
      setShuffle,
    });
    await addStarted.promise;
    expect(TrackPlayer.add).toHaveBeenCalled();

    let newerReplacementObservedCommittedState = false;
    const newerReplacement = runExclusiveNativeQueueReplacement(async ({ isCurrent }) => {
      expect(isCurrent()).toBe(true);
      expect(args.nativeQueueRef.current).toEqual(args.queueContextRef.current);
      newerReplacementObservedCommittedState = true;
    });
    releaseAdd.resolve();
    await Promise.all([shufflePromise, newerReplacement]);

    expect(newerReplacementObservedCommittedState).toBe(true);
    expect(args.setPlaybackQueue).toHaveBeenCalled();
    expect(args.setCurrentSong).toHaveBeenCalledWith(songs[1]);
    expect(setShuffle).toHaveBeenCalledWith(true);
  });

  test('runShuffleQueueAction leaves UI unchanged and native ref truthful when seek fails after add', async () => {
    const args = createQueueArgs();
    args.queueContextRef.current = songs.slice();
    args.baseQueueContextRef.current = songs.slice();
    args.nativeQueueRef.current = songs.slice();
    (TrackPlayer.getQueue as jest.Mock).mockImplementation(async () =>
      (TrackPlayer as unknown as { __getQueue: () => Song[] }).__getQueue());
    (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 's1' });
    (TrackPlayer.seekTo as jest.Mock).mockRejectedValueOnce(new Error('seek failed'));
    const setShuffle = jest.fn();

    await runShuffleQueueAction({
      ...args,
      currentSongId: 's1',
      shuffle: false,
      setShuffle,
    });

    const addedQueue = (TrackPlayer.add as jest.Mock).mock.calls.at(-1)?.[0] as Song[];
    expect(args.nativeQueueRef.current.map(song => song.id)).toEqual(addedQueue.map(song => song.id));
    expect(args.queueContextRef.current.map(song => song.id)).toEqual(addedQueue.map(song => song.id));
    expect(args.baseQueueContextRef.current).toEqual(songs);
    expect(args.setPlaybackQueue).toHaveBeenCalledWith(args.queueContextRef.current);
    expect(args.setCurrentSong).toHaveBeenCalledWith(songs[0]);
    const recoveredShuffle = args.nativeQueueRef.current.some((song, index) => song.id !== songs[index]?.id);
    expect(setShuffle).toHaveBeenCalledWith(recoveredShuffle);
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
    (TrackPlayer.getQueue as jest.Mock).mockResolvedValue([songs[2]]);
    (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 's3' });
    (TrackPlayer.reset as jest.Mock).mockRejectedValueOnce(new Error('reset failed'));
    const setShuffle = jest.fn();

    await runShuffleQueueAction({
      ...args,
      currentSongId: 's1',
      shuffle: false,
      setShuffle,
    });

    expect(args.nativeQueueRef.current).toEqual([songs[2]]);
    expect(args.queueContextRef.current).toEqual([songs[2]]);
    expect(args.baseQueueContextRef.current).toEqual(songs);
    expect(args.setPlaybackQueue).toHaveBeenCalledWith([songs[2]]);
    expect(args.setCurrentSong).toHaveBeenCalledWith(songs[2]);
    expect(setShuffle).toHaveBeenCalledWith(false);
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

    expect(setShuffle).toHaveBeenCalledWith(false);
    expect(args.setPlaybackQueue).toHaveBeenCalledWith([songs[2]]);
    expect(args.setCurrentSong).toHaveBeenCalledWith(songs[2]);
    expect(args.queueContextRef.current).toEqual([songs[2]]);
    expect(args.baseQueueContextRef.current).toEqual(songs);
    expect(args.nativeQueueRef.current).toEqual([songs[2]]);
  });

  test('runShuffleQueueAction leaves UI state unchanged and retains native ref when playback start fails', async () => {
    const args = createQueueArgs();
    args.queueContextRef.current = songs.slice();
    args.baseQueueContextRef.current = songs.slice();
    args.nativeQueueRef.current = songs.slice();
    (TrackPlayer.getQueue as jest.Mock).mockImplementation(async () =>
      (TrackPlayer as unknown as { __getQueue: () => Song[] }).__getQueue());
    (TrackPlayer.getActiveTrack as jest.Mock).mockImplementation(async () => ({ id: 's1' }));
    (TrackPlayer.play as jest.Mock).mockRejectedValueOnce(new Error('play failed'));
    const setShuffle = jest.fn();

    await runShuffleQueueAction({
      ...args,
      currentSongId: 's1',
      shuffle: false,
      setShuffle,
    });

    expect(args.setPlaybackQueue).toHaveBeenCalled();
    const addedQueue = (TrackPlayer.add as jest.Mock).mock.calls.at(-1)?.[0] as Song[];
    const nativeIsShuffled = args.nativeQueueRef.current.some((song, index) => song.id !== songs[index]?.id);
    expect(setShuffle).toHaveBeenCalledWith(nativeIsShuffled);
    const activeAfterReconciliation = args.nativeQueueRef.current[0];
    expect(args.setCurrentSong).toHaveBeenCalledWith(activeAfterReconciliation);
    expect(args.nativeQueueRef.current.map(song => song.id)).toEqual(addedQueue.map(song => song.id));
    expect(args.queueContextRef.current).toEqual(args.nativeQueueRef.current);
    expect(args.baseQueueContextRef.current).toEqual(songs);
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
