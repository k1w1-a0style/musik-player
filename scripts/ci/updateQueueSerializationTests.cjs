'use strict';

const fs = require('fs');

const path = 'contexts/__tests__/playbackQueueActionHelpers.test.ts';
let source = fs.readFileSync(path, 'utf8');

const replaceOnce = (oldText, newText, label) => {
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`Expected exactly one ${label}, found ${count}`);
  source = source.replace(oldText, newText);
};

replaceOnce(
`  test('runPlaySongQueueAction builds its plan from the native ref inside the mutation chain', async () => {
    const args = createQueueArgs();
    args.nativeQueueRef.current = [];
    let releaseBlocker: () => void = () => undefined;
    const blocker = runExclusiveNativeQueueReplacement(async () => {
      await new Promise<void>(resolve => {
        releaseBlocker = resolve;
      });
      args.nativeQueueRef.current = songs.slice();
    });
    await flushMicrotasks();

    const playPromise = runPlaySongQueueAction({ ...args, song: songs[2], queue: songs });
    releaseBlocker();
    await Promise.all([blocker, playPromise]);

    expect(TrackPlayer.reset).not.toHaveBeenCalled();
    expect(TrackPlayer.skip).toHaveBeenCalledWith(2);
    expect(args.nativeQueueRef.current).toEqual(songs);
    expect(args.setCurrentSong).toHaveBeenCalledWith(songs[2]);
  });`,
`  test('runPlaySongQueueAction builds its plan from the native ref inside the mutation chain', async () => {
    const args = createQueueArgs();
    args.nativeQueueRef.current = [];
    let signalBlockerStarted: () => void = () => undefined;
    const blockerStarted = new Promise<void>(resolve => {
      signalBlockerStarted = resolve;
    });
    let releaseBlocker: () => void = () => undefined;
    const blocker = runExclusiveNativeQueueReplacement(async () => {
      signalBlockerStarted();
      await new Promise<void>(resolve => {
        releaseBlocker = resolve;
      });
      args.nativeQueueRef.current = songs.slice();
    });
    await blockerStarted;

    const playPromise = runPlaySongQueueAction({ ...args, song: songs[2], queue: songs });
    releaseBlocker();
    await Promise.all([blocker, playPromise]);

    expect(TrackPlayer.reset).not.toHaveBeenCalled();
    expect(TrackPlayer.skip).toHaveBeenCalledWith(2);
    expect(args.nativeQueueRef.current).toEqual(songs);
    expect(args.setCurrentSong).toHaveBeenCalledWith(songs[2]);
  });`,
'play-song plan serialization timing test',
);

replaceOnce(
`  test('runPlaySongQueueAction commits no stale UI state when superseded during native add', async () => {
    const args = createQueueArgs();
    let resolveAdd: () => void = () => undefined;
    (TrackPlayer.add as jest.Mock).mockImplementationOnce(() => new Promise<void>(resolve => {
      resolveAdd = resolve;
    }));

    const playPromise = runPlaySongQueueAction({ ...args, song: songs[1] });
    for (let attempt = 0; attempt < 20 && !(TrackPlayer.add as jest.Mock).mock.calls.length; attempt += 1) {
      await Promise.resolve();
    }
    expect(TrackPlayer.add).toHaveBeenCalled();

    const newerNativeQueue = [songs[2]];
    const newerReplacement = runExclusiveNativeQueueReplacement(async ({ isCurrent }) => {
      expect(isCurrent()).toBe(true);
      args.nativeQueueRef.current = newerNativeQueue.slice();
    });
    resolveAdd();
    await Promise.all([playPromise, newerReplacement]);

    expect(args.setPlaybackQueue).not.toHaveBeenCalled();
    expect(args.setCurrentSong).not.toHaveBeenCalled();
    expect(args.queueContextRef.current).toEqual([]);
    expect(args.baseQueueContextRef.current).toEqual([]);
    expect(args.nativeQueueRef.current).toEqual(newerNativeQueue);
    expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBeNull();
  });`,
`  test('runPlaySongQueueAction finishes before a newer replacement observes queue state', async () => {
    const args = createQueueArgs();
    let resolveAdd: () => void = () => undefined;
    (TrackPlayer.add as jest.Mock).mockImplementationOnce(() => new Promise<void>(resolve => {
      resolveAdd = resolve;
    }));

    const playPromise = runPlaySongQueueAction({ ...args, song: songs[1] });
    for (let attempt = 0; attempt < 20 && !(TrackPlayer.add as jest.Mock).mock.calls.length; attempt += 1) {
      await Promise.resolve();
    }
    expect(TrackPlayer.add).toHaveBeenCalled();

    let newerReplacementObservedConsistentState = false;
    const newerReplacement = runExclusiveNativeQueueReplacement(async ({ isCurrent }) => {
      expect(isCurrent()).toBe(true);
      expect(args.nativeQueueRef.current).toEqual(songs);
      expect(args.queueContextRef.current).toEqual(songs);
      expect(args.baseQueueContextRef.current).toEqual(songs);
      expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBe('s2');
      newerReplacementObservedConsistentState = true;
    });
    resolveAdd();
    await Promise.all([playPromise, newerReplacement]);

    expect(newerReplacementObservedConsistentState).toBe(true);
    expect(args.setPlaybackQueue).toHaveBeenCalledWith(songs);
    expect(args.setCurrentSong).toHaveBeenCalledWith(songs[1]);
  });`,
'play-song serialization test',
);

replaceOnce(
`  test('runShuffleQueueAction commits nothing stale when superseded during native add', async () => {
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
  });`,
`  test('runShuffleQueueAction finishes before a newer replacement observes queue state', async () => {
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

    let newerReplacementObservedConsistentState = false;
    const newerReplacement = runExclusiveNativeQueueReplacement(async ({ isCurrent }) => {
      expect(isCurrent()).toBe(true);
      expect(args.nativeQueueRef.current).toEqual(args.queueContextRef.current);
      expect(args.baseQueueContextRef.current).toEqual(songs);
      expect(setShuffle).toHaveBeenCalledWith(true);
      newerReplacementObservedConsistentState = true;
    });
    resolveAdd();
    await Promise.all([shufflePromise, newerReplacement]);

    expect(newerReplacementObservedConsistentState).toBe(true);
    expect(args.setPlaybackQueue).toHaveBeenCalledTimes(1);
    expect(args.setCurrentSong).toHaveBeenCalledWith(songs[1]);
  });`,
'shuffle serialization test',
);

fs.writeFileSync(path, source);
