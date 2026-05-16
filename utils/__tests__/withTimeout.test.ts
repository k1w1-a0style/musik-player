import { withTimeout } from '../withTimeout';

test('resolves before timeout', async () => {
  await expect(withTimeout(Promise.resolve('done'), 100, 'too slow')).resolves.toBe('done');
});

test('rejects with timeout message', async () => {
  jest.useFakeTimers();
  const promise = withTimeout(new Promise<string>(() => undefined), 50, 'timeout hit');

  jest.advanceTimersByTime(50);

  await expect(promise).rejects.toThrow('timeout hit');
  jest.useRealTimers();
});

test('clears timer when promise resolves', async () => {
  jest.useFakeTimers();
  const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
  const promise = withTimeout(Promise.resolve('ok'), 100, 'too slow');

  await expect(promise).resolves.toBe('ok');

  expect(clearTimeoutSpy).toHaveBeenCalled();
  clearTimeoutSpy.mockRestore();
  jest.useRealTimers();
});
