'use strict';

const fs = require('fs');

const replaceExactlyOnce = (source, oldText, newText, label) => {
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`Expected exactly one ${label}, found ${count}`);
  return source.replace(oldText, newText);
};

const sourcePath = 'contexts/playbackQueueActionHelpers.ts';
let source = fs.readFileSync(sourcePath, 'utf8');
const oldBlock = `    const previousQueue = queueContextRef.current.slice();
    const previousBaseQueue = baseQueueContextRef.current.slice();
    const previousShuffle = shuffleRef?.current ?? shuffle;
    const previousNativeQueue = nativeQueueRef.current.slice();
    const previousSelectedSong = activeSongId
      ? currentQueue.find(song => normalizeSongId(song.id) === normalizeSongId(activeSongId))
      : undefined;

    const progress = await TrackPlayer.getProgress();
    if (!isCurrent()) return 'stale';

    applyPlaybackQueueState({
      queueContextRef,
      baseQueueContextRef,
      setPlaybackQueue,
      setCurrentSong,
      orderedQueue: plan.queue,
      baseQueue: plan.queue,
      selectedSong: plan.selectedSong,
    });
    if (previousShuffle) {
      if (shuffleRef) shuffleRef.current = false;
      setShuffle(false);
    }

    try {
      const rebuilt = await rebuildNativePlaybackQueueUnlocked(
        toPlayableSongs(plan.queue),
        nativeQueueRef,
        progress.position,
        context,
        plan.currentIndex,
      );
      if (!rebuilt || !isCurrent()) return 'stale';
      return 'applied';
    } catch (error) {
      console.warn('[PlaybackQueue] Reorder failed; rolling back queue.', error);
      applyPlaybackQueueState({
        queueContextRef,
        baseQueueContextRef,
        setPlaybackQueue,
        setCurrentSong,
        orderedQueue: previousQueue,
        baseQueue: previousBaseQueue,
        selectedSong: previousSelectedSong,
      });
      if (shuffleRef) shuffleRef.current = previousShuffle;
      setShuffle(previousShuffle);
      nativeQueueRef.current = previousNativeQueue;
      return 'failed';
    }
`;
const newBlock = `    const previousShuffle = shuffleRef?.current ?? shuffle;
    const progress = await TrackPlayer.getProgress();
    if (!isCurrent()) return 'stale';

    try {
      const rebuilt = await rebuildNativePlaybackQueueUnlocked(
        toPlayableSongs(plan.queue),
        nativeQueueRef,
        progress.position,
        context,
        plan.currentIndex,
      );
      if (!rebuilt || !isCurrent()) return 'stale';

      applyPlaybackQueueState({
        queueContextRef,
        baseQueueContextRef,
        setPlaybackQueue,
        setCurrentSong,
        orderedQueue: plan.queue,
        baseQueue: plan.queue,
        selectedSong: plan.selectedSong,
      });
      if (previousShuffle) {
        if (shuffleRef) shuffleRef.current = false;
        setShuffle(false);
      }
      return 'applied';
    } catch (error) {
      console.warn('[PlaybackQueue] Reorder failed; keeping previous UI state.', error);
      return 'failed';
    }
`;
source = replaceExactlyOnce(source, oldBlock, newBlock, 'queue reorder transaction block');
fs.writeFileSync(sourcePath, source);

const testPath = 'contexts/__tests__/playbackQueueReorderAction.test.ts';
let tests = fs.readFileSync(testPath, 'utf8');
tests = replaceExactlyOnce(
  tests,
  "import { resetNativeQueueMutationLockForTests } from '../../utils/nativeQueueMutationLock';",
  "import { resetNativeQueueMutationLockForTests, runExclusiveNativeQueueReplacement } from '../../utils/nativeQueueMutationLock';",
  'native queue lock import',
);
const marker = "  test('does not move the current track', async () => {";
const additions = `  test('keeps UI state unchanged and native ref truthful when native rebuild fails after reset', async () => {
    const args = createArgs();
    (TrackPlayer.add as jest.Mock).mockRejectedValueOnce(new Error('native add failed'));

    await expect(runReorderQueueAction({
      ...args,
      fromIndex: 2,
      toIndex: 1,
      currentSongId: 's1',
      shuffle: false,
      setShuffle: args.setShuffle,
    })).resolves.toBe(false);

    expect(args.queueContextRef.current).toEqual(songs);
    expect(args.baseQueueContextRef.current).toEqual(songs);
    expect(args.setPlaybackQueue).not.toHaveBeenCalled();
    expect(args.setCurrentSong).not.toHaveBeenCalled();
    expect(args.setShuffle).not.toHaveBeenCalled();
    expect(args.nativeQueueRef.current).toEqual([]);
  });

  test('commits no stale UI state when a newer replacement supersedes native add', async () => {
    const args = createArgs();
    let resolveAdd: () => void = () => undefined;
    (TrackPlayer.add as jest.Mock).mockImplementationOnce(() => new Promise<void>(resolve => {
      resolveAdd = resolve;
    }));

    const reorderPromise = runReorderQueueAction({
      ...args,
      fromIndex: 2,
      toIndex: 1,
      currentSongId: 's1',
      shuffle: false,
      setShuffle: args.setShuffle,
    });
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
    await Promise.all([reorderPromise, newerReplacement]);

    expect(args.queueContextRef.current).toEqual(songs);
    expect(args.baseQueueContextRef.current).toEqual(songs);
    expect(args.setPlaybackQueue).not.toHaveBeenCalled();
    expect(args.setCurrentSong).not.toHaveBeenCalled();
    expect(args.setShuffle).not.toHaveBeenCalled();
    expect(args.nativeQueueRef.current).toEqual(newerNativeQueue);
  });

`;
tests = replaceExactlyOnce(tests, marker, additions + marker, 'queue reorder test marker');
fs.writeFileSync(testPath, tests);
