import { runNativeReadWithTimeout } from '../nativeReadTimeout';

afterEach(() => { jest.useRealTimers(); });

test('disposes a resource returned after a shorter feature timeout', async () => {
  jest.useFakeTimers();
  let complete!: (value: { leaseId: string }) => void;
  const onDiscard = jest.fn();
  const pending = runNativeReadWithTimeout(() => new Promise<{ leaseId: string }>(resolve => { complete = resolve; }),
    { label: 'leased artwork', timeoutMs: 10, onDiscard });
  await jest.advanceTimersByTimeAsync(10);
  await expect(pending).resolves.toEqual({ kind: 'timeout' });
  complete({ leaseId: 'late-lease' });
  await jest.advanceTimersByTimeAsync(0);
  expect(onDiscard).toHaveBeenCalledTimes(1);
  expect(onDiscard).toHaveBeenCalledWith({ leaseId: 'late-lease' });
});

test('disposes a late result after cancellation without starting an already cancelled read', async () => {
  jest.useFakeTimers();
  const controller = new AbortController();
  let complete!: (value: { leaseId: string }) => void;
  const operation = jest.fn(() => new Promise<{ leaseId: string }>(resolve => { complete = resolve; }));
  const onDiscard = jest.fn();
  const pending = runNativeReadWithTimeout(operation, { label: 'leased artwork', timeoutMs: 100,
    signal: controller.signal, onDiscard });
  const aborted = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort();
  await aborted;
  complete({ leaseId: 'abandoned-lease' });
  await jest.advanceTimersByTimeAsync(0);
  expect(onDiscard).toHaveBeenCalledTimes(1);
  expect(onDiscard).toHaveBeenCalledWith({ leaseId: 'abandoned-lease' });

  operation.mockClear();
  onDiscard.mockClear();
  await expect(runNativeReadWithTimeout(operation, { label: 'already aborted', signal: controller.signal, onDiscard }))
    .rejects.toMatchObject({ name: 'AbortError' });
  expect(operation).not.toHaveBeenCalled();
  expect(onDiscard).not.toHaveBeenCalled();
});

test('leaves ownership with a timely successful consumer', async () => {
  jest.useFakeTimers();
  const resource = { leaseId: 'active-lease' };
  const onDiscard = jest.fn();
  await expect(runNativeReadWithTimeout(async () => resource, { label: 'leased artwork', timeoutMs: 10, onDiscard }))
    .resolves.toEqual({ kind: 'success', value: resource });
  expect(onDiscard).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});
