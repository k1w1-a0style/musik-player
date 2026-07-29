import {
  getNativeQueueReplacementVersion,
  resetNativeQueueMutationLockForTests,
  runExclusiveNativePlaybackControl,
  runExclusiveNativeQueueReplacement,
} from '../nativeQueueMutationLock';

const createDeferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(promiseResolve => { resolve = promiseResolve; });
  return { promise, resolve };
};

describe('nativeQueueMutationLock', () => {
  beforeEach(() => {
    resetNativeQueueMutationLockForTests();
  });

  test('playback controls serialize without invalidating an active queue replacement', async () => {
    const events: string[] = [];
    let replacementIsCurrentAfterControlIntent = false;
    let control: Promise<void> | undefined;

    const replacement = runExclusiveNativeQueueReplacement(async ({ isCurrent }) => {
      events.push('replacement:start');
      control = runExclusiveNativePlaybackControl(async () => {
        events.push('control');
      });

      replacementIsCurrentAfterControlIntent = isCurrent();
      events.push('replacement:end');
    });

    await replacement;
    await control;

    expect(replacementIsCurrentAfterControlIntent).toBe(true);
    expect(getNativeQueueReplacementVersion()).toBe(1);
    expect(events).toEqual(['replacement:start', 'replacement:end', 'control']);
  });

  test('a newer intent does not invalidate a replacement that already started', async () => {
    const firstStarted = createDeferred();
    const releaseFirst = createDeferred();
    let firstReplacementIsCurrent = false;
    let secondReplacementIsCurrent = false;

    const firstReplacement = runExclusiveNativeQueueReplacement(async ({ isCurrent }) => {
      firstStarted.resolve();
      await releaseFirst.promise;
      firstReplacementIsCurrent = isCurrent();
    });

    await firstStarted.promise;

    const secondReplacement = runExclusiveNativeQueueReplacement(async ({ isCurrent }) => {
      secondReplacementIsCurrent = isCurrent();
    });

    releaseFirst.resolve();
    await Promise.all([firstReplacement, secondReplacement]);

    expect(firstReplacementIsCurrent).toBe(true);
    expect(secondReplacementIsCurrent).toBe(true);
    expect(getNativeQueueReplacementVersion()).toBe(2);
  });

  test('an older queued replacement starts stale when a newer intent overtakes it', async () => {
    const controlStarted = createDeferred();
    const releaseControl = createDeferred();
    const control = runExclusiveNativePlaybackControl(async () => {
      controlStarted.resolve();
      await releaseControl.promise;
    });
    await controlStarted.promise;

    let firstReplacementIsCurrent = true;
    let secondReplacementIsCurrent = false;
    const firstReplacement = runExclusiveNativeQueueReplacement(async ({ isCurrent }) => {
      firstReplacementIsCurrent = isCurrent();
    });
    const secondReplacement = runExclusiveNativeQueueReplacement(async ({ isCurrent }) => {
      secondReplacementIsCurrent = isCurrent();
    });

    releaseControl.resolve();
    await Promise.all([control, firstReplacement, secondReplacement]);

    expect(firstReplacementIsCurrent).toBe(false);
    expect(secondReplacementIsCurrent).toBe(true);
    expect(getNativeQueueReplacementVersion()).toBe(2);
  });

  test('failed mutations do not block later playback controls', async () => {
    const events: string[] = [];

    await expect(runExclusiveNativeQueueReplacement(async () => {
      events.push('replacement:start');
      throw new Error('native failure');
    })).rejects.toThrow('native failure');

    await runExclusiveNativePlaybackControl(async () => {
      events.push('control:after-failure');
    });

    expect(events).toEqual(['replacement:start', 'control:after-failure']);
  });

  test('resetNativeQueueMutationLockForTests clears replacement version and pending chain', async () => {
    const replacementStarted = createDeferred();
    const releaseBlockedReplacement = createDeferred();
    const blockedReplacement = runExclusiveNativeQueueReplacement(async () => {
      replacementStarted.resolve();
      await releaseBlockedReplacement.promise;
    });

    await replacementStarted.promise;
    expect(getNativeQueueReplacementVersion()).toBe(1);

    resetNativeQueueMutationLockForTests();

    const events: string[] = [];
    await runExclusiveNativePlaybackControl(async () => {
      events.push('control:after-reset');
    });

    releaseBlockedReplacement.resolve();
    await blockedReplacement;

    expect(getNativeQueueReplacementVersion()).toBe(0);
    expect(events).toEqual(['control:after-reset']);
  });
});
