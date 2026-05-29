import { OperationAbortError, TimeoutError, isAbortError, isTimeoutError, throwIfAborted, withTimeout } from '../withTimeout';

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

  test('rejects with recognizable timeout error when wrapped operation does not settle in time', async () => {
    const result = withTimeout(new Promise<string>(() => undefined), 1000, 'timed out');

    jest.advanceTimersByTime(1000);

    await expect(result).rejects.toThrow(TimeoutError);
    await expect(result).rejects.toThrow('timed out');
    try {
      await result;
    } catch (error) {
      expect(isTimeoutError(error)).toBe(true);
    }
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

  test('aborts provided operation signal on timeout', async () => {
    let operationSignal: AbortSignal | undefined;
    const result = withTimeout<string>(signal => {
      operationSignal = signal;
      return new Promise(() => undefined);
    }, 1000, 'timed out');

    jest.advanceTimersByTime(1000);

    await expect(result).rejects.toThrow(TimeoutError);
    expect(operationSignal?.aborted).toBe(true);
    expect(operationSignal?.reason).toBeInstanceOf(TimeoutError);
  });

  test('already aborted external signal aborts immediately', async () => {
    const controller = new AbortController();
    controller.abort(new OperationAbortError('cancelled before start'));

    await expect(withTimeout(Promise.resolve('ok'), 1000, 'too slow', { signal: controller.signal })).rejects.toThrow('cancelled before start');
    expect(jest.getTimerCount()).toBe(0);
  });

  test('external abort rejects and aborts operation signal', async () => {
    const controller = new AbortController();
    let operationSignal: AbortSignal | undefined;
    const result = withTimeout<string>(signal => {
      operationSignal = signal;
      return new Promise(() => undefined);
    }, 1000, 'too slow', { signal: controller.signal });

    controller.abort(new OperationAbortError('user cancelled'));

    await expect(result).rejects.toThrow('user cancelled');
    expect(operationSignal?.aborted).toBe(true);
    expect(isAbortError(operationSignal?.reason)).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('throwIfAborted turns abort state into controlled abort error', () => {
    const controller = new AbortController();
    controller.abort('stopped');

    expect(() => throwIfAborted(controller.signal)).toThrow(OperationAbortError);
    expect(() => throwIfAborted(controller.signal)).toThrow('stopped');
  });
});
