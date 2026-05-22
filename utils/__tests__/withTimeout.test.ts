import { withTimeout } from '../withTimeout';

describe('withTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('resolves with the wrapped promise result before timeout', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1000, 'too slow')).resolves.toBe('ok');
  });

  test('rejects with the wrapped promise rejection before timeout', async () => {
    await expect(withTimeout(Promise.reject(new Error('source failed')), 1000, 'too slow')).rejects.toThrow('source failed');
  });

  test('rejects with timeout message when wrapped promise does not settle in time', async () => {
    const result = withTimeout(new Promise<string>(() => undefined), 1000, 'timed out');

    jest.advanceTimersByTime(1000);

    await expect(result).rejects.toThrow('timed out');
  });

  test('clears pending timeout after successful resolution', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    await withTimeout(Promise.resolve('ok'), 1000, 'too slow');

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('clears pending timeout after wrapped promise rejection', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    await expect(withTimeout(Promise.reject(new Error('source failed')), 1000, 'too slow')).rejects.toThrow('source failed');

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});
