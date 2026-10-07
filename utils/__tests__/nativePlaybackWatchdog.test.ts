import { createNativePlaybackWatchdog, getNativePlaybackWatchdogSnapshot, resetNativePlaybackWatchdogForTests } from '../nativePlaybackWatchdog';
import { resetNativeQueueMutationLockForTests, runExclusiveNativePlaybackControl } from '../nativeQueueMutationLock';

const deferred = () => {
  let resolve!: () => void;
  return { promise: new Promise<void>(done => { resolve = done; }), resolve: () => resolve() };
};
beforeEach(() => { resetNativeQueueMutationLockForTests(); jest.useFakeTimers(); });
afterEach(() => { resetNativePlaybackWatchdogForTests(); jest.useRealTimers(); });

test('waiting behind another writer does not spend the next operation response budget', async () => {
  const first = deferred(); const began = deferred(); const next = deferred(); const nextBegan = deferred();
  const blocker = runExclusiveNativePlaybackControl(async () => { began.resolve(); await first.promise; }, { timeoutMs: 1000 });
  await began.promise;
  const operation = runExclusiveNativePlaybackControl(async () => { nextBegan.resolve(); await next.promise; }, { timeoutMs: 40 });
  const outcome = operation.catch(error => error);
  await jest.advanceTimersByTimeAsync(100);
  expect(getNativePlaybackWatchdogSnapshot().status).toBe('idle');
  first.resolve(); await blocker; await jest.advanceTimersByTimeAsync(0);
  expect(getNativePlaybackWatchdogSnapshot().status).toBe('idle');
  await nextBegan.promise;
  await jest.advanceTimersByTimeAsync(39);
  expect(getNativePlaybackWatchdogSnapshot().status).toBe('idle');
  next.resolve(); await operation;
  expect(await outcome).toBeUndefined();
});

test('start is idempotent and cannot extend an already running deadline', async () => {
  const native = deferred();
  const watchdog = createNativePlaybackWatchdog('control', 40);
  const outcome = watchdog.observe(native.promise).catch(error => error);
  await jest.advanceTimersByTimeAsync(100);
  expect(getNativePlaybackWatchdogSnapshot().status).toBe('idle');
  watchdog.start(); await jest.advanceTimersByTimeAsync(30); watchdog.start();
  await jest.advanceTimersByTimeAsync(10);
  expect(await outcome).toMatchObject({ name: 'NativePlaybackTimeoutError' });
  expect(getNativePlaybackWatchdogSnapshot().status).toBe('quarantined');
  native.resolve(); await jest.advanceTimersByTimeAsync(0);
  expect(getNativePlaybackWatchdogSnapshot().status).toBe('retry-required');
});
