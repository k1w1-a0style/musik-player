import {
  getNativeQueueReplacementVersionForTests,
  resetNativeQueueMutationLockForTests,
  runExclusiveNativePlaybackControl,
  runExclusiveNativeQueueReplacement,
} from '../nativeQueueMutationLock';
import {
  acquireNativeHydrationGate,
  publishNativeHydrationGate,
  resetNativeHydrationGateForTests,
} from '../nativeHydrationGate';
import { requestLatestSeek, resetSeekControllerForTests } from '../seekController';

const createDeferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(promiseResolve => { resolve = promiseResolve; });
  return { promise, resolve };
};

describe('nativeQueueMutationLock', () => {
  beforeEach(() => {
    resetNativeQueueMutationLockForTests();
    resetNativeHydrationGateForTests();
    resetSeekControllerForTests();
  });

  test.each(['unowned', 'loading', 'degraded', 'retry-required'] as const)(
    'fails closed for a protected playback control captured while the gate is %s',
    async status => {
      if (status !== 'unowned') {
        const owner = acquireNativeHydrationGate();
        publishNativeHydrationGate(owner, status);
      }
      const nativeAction = jest.fn(async () => undefined);

      await expect(runExclusiveNativePlaybackControl(nativeAction, {
        requireStableReadyHydration: true,
      })).rejects.toMatchObject({ name: 'NativeMutationHydrationStaleError' });
      expect(nativeAction).not.toHaveBeenCalled();
    },
  );

  test('keeps an unprotected playback control compatible without a ready gate', async () => {
    const nativeAction = jest.fn(async () => undefined);

    await runExclusiveNativePlaybackControl(nativeAction);

    expect(nativeAction).toHaveBeenCalledTimes(1);
  });

  test('fails closed before versioning a protected replacement without a ready gate', async () => {
    const runningStarted = createDeferred();
    const releaseRunning = createDeferred();
    let runningIsCurrent = false;
    const running = runExclusiveNativeQueueReplacement(async ({ isCurrent }) => {
      runningStarted.resolve();
      await releaseRunning.promise;
      runningIsCurrent = isCurrent();
    });
    await runningStarted.promise;
    const callback = jest.fn(async () => undefined);

    await expect(runExclusiveNativeQueueReplacement(callback, {
      requireStableReadyHydration: true,
    })).rejects.toMatchObject({ name: 'NativeMutationHydrationStaleError' });
    expect(callback).not.toHaveBeenCalled();
    expect(getNativeQueueReplacementVersionForTests()).toBe(1);

    releaseRunning.resolve();
    await running;
    expect(runningIsCurrent).toBe(true);
  });

  test('does not start a protected replacement after its ready snapshot becomes stale', async () => {
    const blockerStarted = createDeferred();
    const releaseBlocker = createDeferred();
    const blocker = runExclusiveNativePlaybackControl(async () => {
      blockerStarted.resolve();
      await releaseBlocker.promise;
    });
    await blockerStarted.promise;
    const owner = acquireNativeHydrationGate();
    publishNativeHydrationGate(owner, 'ready');
    const callback = jest.fn(async () => undefined);
    const replacement = runExclusiveNativeQueueReplacement(callback, { requireStableReadyHydration: true });

    acquireNativeHydrationGate();
    releaseBlocker.resolve();

    await blocker;
    await expect(replacement).rejects.toMatchObject({ name: 'NativeMutationHydrationStaleError' });
    expect(callback).not.toHaveBeenCalled();
  });

  test('keeps replacement current after its ready start validation succeeds', async () => {
    const actionStarted = createDeferred();
    const releaseNativeStep = createDeferred();
    const owner = acquireNativeHydrationGate();
    publishNativeHydrationGate(owner, 'ready');
    let currentAfterNativeStep = false;
    const replacement = runExclusiveNativeQueueReplacement(async ({ isCurrent, beginNativeMutation }) => {
      actionStarted.resolve();
      beginNativeMutation();
      await releaseNativeStep.promise;
      currentAfterNativeStep = isCurrent();
    }, { requireStableReadyHydration: true });
    await actionStarted.promise;

    acquireNativeHydrationGate();
    releaseNativeStep.resolve();
    await replacement;

    expect(currentAfterNativeStep).toBe(true);
  });

  test('executes protected playback and replacement exactly once while ready remains stable', async () => {
    const owner = acquireNativeHydrationGate();
    publishNativeHydrationGate(owner, 'ready');
    const control = jest.fn(async () => undefined);
    const replacement = jest.fn(async () => undefined);

    await runExclusiveNativePlaybackControl(control, { requireStableReadyHydration: true });
    await runExclusiveNativeQueueReplacement(replacement, { requireStableReadyHydration: true });

    expect(control).toHaveBeenCalledTimes(1);
    expect(replacement).toHaveBeenCalledTimes(1);
  });

  test('does not execute a ready playback control after a new hydration generation starts', async () => {
    const blockerStarted = createDeferred();
    const releaseBlocker = createDeferred();
    const blocker = runExclusiveNativeQueueReplacement(async () => {
      blockerStarted.resolve();
      await releaseBlocker.promise;
    });
    await blockerStarted.promise;

    const firstOwner = acquireNativeHydrationGate();
    publishNativeHydrationGate(firstOwner, 'ready');
    const nativeAction = jest.fn(async () => undefined);
    const queued = runExclusiveNativePlaybackControl(nativeAction, { requireStableReadyHydration: true });

    const nextOwner = acquireNativeHydrationGate();
    publishNativeHydrationGate(nextOwner, 'loading');
    releaseBlocker.resolve();

    await blocker;
    await expect(queued).rejects.toMatchObject({ name: 'NativeMutationHydrationStaleError' });
    expect(nativeAction).not.toHaveBeenCalled();
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
    expect(getNativeQueueReplacementVersionForTests()).toBe(1);
    expect(events).toEqual(['replacement:start', 'replacement:end', 'control']);
  });

  test('a newer intent does not invalidate a replacement that already started', async () => {
    const firstStarted = createDeferred();
    const releaseFirst = createDeferred();
    let firstReplacementIsCurrent = false;
    let secondReplacementIsCurrent = false;

    const firstReplacement = runExclusiveNativeQueueReplacement(async ({ isCurrent, beginNativeMutation }) => {
      firstStarted.resolve();
      beginNativeMutation();
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
    expect(getNativeQueueReplacementVersionForTests()).toBe(2);
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
    expect(getNativeQueueReplacementVersionForTests()).toBe(2);
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

  test('invalidates queued seeks and drains the active seek before replacing the queue', async () => {
    const seekStarted = createDeferred();
    const releaseSeek = createDeferred();
    const seek = jest.fn(async () => {
      seekStarted.resolve();
      await releaseSeek.promise;
    });
    const firstSeek = requestLatestSeek(1000, seek);
    await seekStarted.promise;
    void requestLatestSeek(9000, seek);
    const replacement = jest.fn(async () => undefined);

    const queuedReplacement = runExclusiveNativeQueueReplacement(replacement);
    await Promise.resolve();
    const blockedSeek = requestLatestSeek(12000, seek);

    expect(replacement).not.toHaveBeenCalled();
    expect(seek).toHaveBeenCalledTimes(1);

    releaseSeek.resolve();
    await Promise.all([firstSeek, blockedSeek, queuedReplacement]);

    expect(replacement).toHaveBeenCalledTimes(1);
    expect(seek).toHaveBeenCalledTimes(1);

    await requestLatestSeek(13000, seek);
    expect(seek).toHaveBeenNthCalledWith(2, 13);
  });

  test('resetNativeQueueMutationLockForTests clears replacement version and pending chain', async () => {
    const replacementStarted = createDeferred();
    const releaseBlockedReplacement = createDeferred();
    const blockedReplacement = runExclusiveNativeQueueReplacement(async () => {
      replacementStarted.resolve();
      await releaseBlockedReplacement.promise;
    });

    await replacementStarted.promise;
    expect(getNativeQueueReplacementVersionForTests()).toBe(1);

    resetNativeQueueMutationLockForTests();

    const events: string[] = [];
    await runExclusiveNativePlaybackControl(async () => {
      events.push('control:after-reset');
    });

    releaseBlockedReplacement.resolve();
    await blockedReplacement;

    expect(getNativeQueueReplacementVersionForTests()).toBe(0);
    expect(events).toEqual(['control:after-reset']);
  });
});
