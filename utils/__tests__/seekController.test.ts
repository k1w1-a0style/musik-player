import { requestLatestSeek, isSeekDraining, resetSeekControllerForTests } from '../seekController';

describe('seekController', () => {
  beforeEach(() => {
    resetSeekControllerForTests();
    jest.clearAllMocks();
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
