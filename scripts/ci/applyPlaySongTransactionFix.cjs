'use strict';

const fs = require('fs');

const replaceExactlyOnce = (source, oldText, newText, label) => {
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`Expected exactly one ${label}, found ${count}`);
  return source.replace(oldText, newText);
};

const sourcePath = 'contexts/playbackQueueActionHelpers.ts';
let source = fs.readFileSync(sourcePath, 'utf8');
source = replaceExactlyOnce(
  source,
  `  runExclusiveNativePlaybackControl,\n  runExclusiveNativeQueueReplacement,`,
  `  runExclusiveNativeQueueReplacement,`,
  'native mutation import',
);

const oldFunction = `export const runPlaySongQueueAction = async ({
  song,
  queue,
  songsRef,
  queueContextRef,
  baseQueueContextRef,
  nativeQueueRef,
  setPlaybackQueue,
  setCurrentSong,
}: RunPlaySongQueueActionArgs): Promise<void> => {
  const sourceQueue = queue && queue.length > 0 ? queue : songsRef.current;
  const plan = buildPlaySongQueuePlan(song, sourceQueue, nativeQueueRef.current);
  if (!plan) {
    console.warn('[PlaybackQueue] Unable to build play-song queue plan.', { songId: song.id });
    return;
  }

  const { requestedSong, queueWithRequested, nativeIndex, canReuseNativeQueue } = plan;

  if (canReuseNativeQueue) {
    const orderedQueue = plan.reusableOrderedQueue;

    try {
      await runExclusiveNativePlaybackControl(async () => {
        const activeTrack = await TrackPlayer.getActiveTrack();
        if (activeTrack?.id !== requestedSong.id) {
          await TrackPlayer.skip(nativeIndex);
        }
        await TrackPlayer.play();
      });
      applyPlaybackQueueState({
        queueContextRef,
        baseQueueContextRef,
        setPlaybackQueue,
        setCurrentSong,
        orderedQueue,
        baseQueue: queueWithRequested,
        selectedSong: requestedSong,
      });
      await persistRequestedSongId(requestedSong, songsRef.current);
      return;
    } catch (error) {
      console.warn('[PlaybackQueue] Native skip failed, rebuilding queue.', error);
      // Fall through to a full queue rebuild if native skip is unavailable/fails.
    }
  }

  const orderedQueue = plan.rebuildOrderedQueue;
  const orderedStartIndex = orderedQueue.findIndex(item => normalizeSongId(item.id) === normalizeSongId(requestedSong.id));
  await rebuildNativePlaybackQueue(orderedQueue, nativeQueueRef, undefined, orderedStartIndex);
  applyPlaybackQueueState({
    queueContextRef,
    baseQueueContextRef,
    setPlaybackQueue,
    setCurrentSong,
    orderedQueue,
    baseQueue: queueWithRequested,
    selectedSong: requestedSong,
  });
  await persistRequestedSongId(requestedSong, songsRef.current);
};`;

const newFunction = `export const runPlaySongQueueAction = async ({
  song,
  queue,
  songsRef,
  queueContextRef,
  baseQueueContextRef,
  nativeQueueRef,
  setPlaybackQueue,
  setCurrentSong,
}: RunPlaySongQueueActionArgs): Promise<void> => {
  await runExclusiveNativeQueueReplacement(async context => {
    const { isCurrent } = context;
    if (!isCurrent()) return;

    const sourceQueue = queue && queue.length > 0 ? queue : songsRef.current;
    const plan = buildPlaySongQueuePlan(song, sourceQueue, nativeQueueRef.current);
    if (!plan) {
      console.warn('[PlaybackQueue] Unable to build play-song queue plan.', { songId: song.id });
      return;
    }

    const { requestedSong, queueWithRequested, nativeIndex, canReuseNativeQueue } = plan;
    let orderedQueue = plan.rebuildOrderedQueue;

    if (canReuseNativeQueue) {
      try {
        const activeTrack = await TrackPlayer.getActiveTrack();
        if (!isCurrent()) return;
        if (activeTrack?.id !== requestedSong.id) {
          await TrackPlayer.skip(nativeIndex);
          if (!isCurrent()) return;
        }
        await TrackPlayer.play();
        if (!isCurrent()) return;
        orderedQueue = plan.reusableOrderedQueue;
      } catch (error) {
        console.warn('[PlaybackQueue] Native skip failed, rebuilding queue.', error);
        if (!isCurrent()) return;
        const orderedStartIndex = orderedQueue.findIndex(
          item => normalizeSongId(item.id) === normalizeSongId(requestedSong.id),
        );
        const rebuilt = await rebuildNativePlaybackQueueUnlocked(
          orderedQueue,
          nativeQueueRef,
          undefined,
          context,
          orderedStartIndex,
        );
        if (!rebuilt || !isCurrent()) return;
      }
    } else {
      const orderedStartIndex = orderedQueue.findIndex(
        item => normalizeSongId(item.id) === normalizeSongId(requestedSong.id),
      );
      const rebuilt = await rebuildNativePlaybackQueueUnlocked(
        orderedQueue,
        nativeQueueRef,
        undefined,
        context,
        orderedStartIndex,
      );
      if (!rebuilt || !isCurrent()) return;
    }

    applyPlaybackQueueState({
      queueContextRef,
      baseQueueContextRef,
      setPlaybackQueue,
      setCurrentSong,
      orderedQueue,
      baseQueue: queueWithRequested,
      selectedSong: requestedSong,
    });

    try {
      await persistRequestedSongId(requestedSong, songsRef.current);
    } catch (error) {
      console.warn('[PlaybackQueue] Failed to persist current song after successful playback.', error);
    }
  });
};`;

source = replaceExactlyOnce(source, oldFunction, newFunction, 'play-song action');
fs.writeFileSync(sourcePath, source);

const testPath = 'contexts/__tests__/playbackQueueActionHelpers.test.ts';
let tests = fs.readFileSync(testPath, 'utf8');
const marker = `  test('runPlaySongQueueAction skips playback for songs without playable uri', async () => {`;
const additions = `  test('runPlaySongQueueAction builds its plan from the native ref inside the mutation chain', async () => {
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
  });

  test('runPlaySongQueueAction commits no stale UI state when superseded during native add', async () => {
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
  });

`;
tests = replaceExactlyOnce(tests, marker, additions + marker, 'play-song test marker');
fs.writeFileSync(testPath, tests);
