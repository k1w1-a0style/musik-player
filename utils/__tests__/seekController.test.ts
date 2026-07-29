import { requestLatestSeek, isSeekDraining, resetSeekControllerForTests } from '../seekController';
import { acquireNativeHydrationGate, publishNativeHydrationGate, resetNativeHydrationGateForTests } from '../nativeHydrationGate';

describe('seekController', () => {
  beforeEach(() => {
    resetSeekControllerForTests();
    resetNativeHydrationGateForTests();
    jest.clearAllMocks();
  });

  test('drops a coalesced seek when hydration changes before its native execution', async () => {
    const owner = acquireNativeHydrationGate();
    publishNativeHydrationGate(owner, 'ready');
    let releaseFirst!: () => void;
    const seek = jest.fn(() => new Promise<void>(resolve => { releaseFirst = resolve; }));

    const first = requestLatestSeek(1000, seek, { requireStableReadyHydration: true });
    void requestLatestSeek(9000, seek, { requireStableReadyHydration: true });
    const nextOwner = acquireNativeHydrationGate();
    publishNativeHydrationGate(nextOwner, 'loading');
    releaseFirst();
    await first;

    expect(seek).toHaveBeenCalledTimes(1);
    expect(seek).toHaveBeenCalledWith(1);
  });

  test.each(['unowned', 'loading', 'degraded', 'retry-required'] as const)(
    'settles a protected seek without native execution while the gate is %s',
    async status => {
      if (status !== 'unowned') {
        const owner = acquireNativeHydrationGate();
        publishNativeHydrationGate(owner, status);
      }
      const seek = jest.fn().mockResolvedValue(undefined);

      await expect(requestLatestSeek(5000, seek, {
        requireStableReadyHydration: true,
      })).resolves.toBeUndefined();
      expect(seek).not.toHaveBeenCalled();
    },
  );

  test('executes a protected seek exactly once while ready remains stable', async () => {
    const owner = acquireNativeHydrationGate();
    publishNativeHydrationGate(owner, 'ready');
    const seek = jest.fn().mockResolvedValue(undefined);

    await requestLatestSeek(5000, seek, { requireStableReadyHydration: true });

    expect(seek).toHaveBeenCalledTimes(1);
    expect(seek).toHaveBeenCalledWith(5);
  });

  test('converts milliseconds to seconds for a single seek', async () => {
    const seek = jest.fn().mockResolvedValue(undefined);

    await requestLatestSeek(5000, seek);

    expect(seek).toHaveBeenCalledTimes(1);
    expect(seek).toHaveBeenCalledWith(5);
    expect(isSeekDraining()).toBe(false);
  });

  test('clamps negative and NaN targets to zero seconds', async () => {
    const seek = jest.fn().mockResolvedValue(undefined);

    await requestLatestSeek(-5000, seek);
    await requestLatestSeek(Number.NaN, seek);

    expect(seek).toHaveBeenNthCalledWith(1, 0);
    expect(seek).toHaveBeenNthCalledWith(2, 0);
  });

  test('coalesces rapid seeks so only the latest queued target is sent (last value wins)', async () => {
    const calls: number[] = [];
    let resolveFirst: () => void = () => undefined;
    const seek = jest.fn((seconds: number) => {
      calls.push(seconds);
      if (calls.length === 1) {
        return new Promise<void>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve();
    });

    const first = requestLatestSeek(1000, seek);
    // These arrive while the first seek is still in flight.
    void requestLatestSeek(2000, seek);
    void requestLatestSeek(3000, seek);
    void requestLatestSeek(8000, seek);

    expect(isSeekDraining()).toBe(true);

    resolveFirst();
    await first;

    expect(calls).toEqual([1, 8]);
    expect(seek).toHaveBeenCalledTimes(2);
    expect(isSeekDraining()).toBe(false);
  });


  test('requests made while draining await the active lane before settling', async () => {
    const calls: number[] = [];
    let resolveFirst: () => void = () => undefined;
    const seek = jest.fn((seconds: number) => {
      calls.push(seconds);
      if (calls.length === 1) {
        return new Promise<void>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve();
    });

    const first = requestLatestSeek(1000, seek);
    const second = requestLatestSeek(9000, seek);
    let secondSettled = false;
    second.then(() => {
      secondSettled = true;
    });

    await Promise.resolve();

    expect(secondSettled).toBe(false);
    expect(isSeekDraining()).toBe(true);

    resolveFirst();
    await Promise.all([first, second]);

    expect(calls).toEqual([1, 9]);
    expect(secondSettled).toBe(true);
    expect(isSeekDraining()).toBe(false);
  });

  test('swallows native seek errors and keeps the lane usable', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const seek = jest
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(undefined);

    await requestLatestSeek(5000, seek);
    await requestLatestSeek(6000, seek);

    expect(warn).toHaveBeenCalledWith('[Seek] native seek failed.', expect.any(Error));
    expect(seek).toHaveBeenNthCalledWith(2, 6);
    expect(isSeekDraining()).toBe(false);
    warn.mockRestore();
  });
});
