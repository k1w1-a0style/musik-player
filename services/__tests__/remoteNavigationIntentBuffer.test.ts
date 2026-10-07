import { createRemoteNavigationIntentBuffer } from '../remoteNavigationIntentBuffer';
import { acquireNativeHydrationGate, publishNativeHydrationGate, releaseNativeHydrationGate, resetNativeHydrationGateForTests } from '../../utils/nativeHydrationGate';

beforeEach(() => { resetNativeHydrationGateForTests(); jest.restoreAllMocks(); });
afterEach(() => jest.useRealTimers());

test('replays startup commands once in their submitted order', () => {
  const owner = acquireNativeHydrationGate();
  const buffer = createRemoteNavigationIntentBuffer();
  const order: string[] = [];
  buffer.submit(() => order.push('next'));
  buffer.submit(() => order.push('previous'));
  buffer.submit(() => order.push('next'));
  expect(order).toEqual([]);
  publishNativeHydrationGate(owner, 'ready');
  publishNativeHydrationGate(owner, 'ready');
  expect(order).toEqual(['next', 'previous', 'next']);
  buffer.dispose();
});

test('accepts at most five pending presses and does not evict an earlier command', () => {
  const owner = acquireNativeHydrationGate();
  const buffer = createRemoteNavigationIntentBuffer();
  const calls = Array.from({ length: 6 }, () => jest.fn());
  calls.slice(0, 5).forEach(run => expect(buffer.submit(run)).toBe(true));
  expect(buffer.submit(calls[5])).toBe(false);
  publishNativeHydrationGate(owner, 'ready');
  calls.slice(0, 5).forEach(run => expect(run).toHaveBeenCalledTimes(1));
  expect(calls[5]).not.toHaveBeenCalled();
  buffer.dispose();
});

test('expires each press independently after five seconds', () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
  const owner = acquireNativeHydrationGate();
  const buffer = createRemoteNavigationIntentBuffer();
  const expired = jest.fn();
  const fresh = jest.fn();
  buffer.submit(expired);
  now.mockReturnValue(3000);
  buffer.submit(fresh);
  now.mockReturnValue(6001);
  publishNativeHydrationGate(owner, 'ready');
  expect(expired).not.toHaveBeenCalled();
  expect(fresh).toHaveBeenCalledTimes(1);
  buffer.dispose();
});

test('expired presses no longer consume the capacity', () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
  const owner = acquireNativeHydrationGate();
  const buffer = createRemoteNavigationIntentBuffer();
  const expired = jest.fn();
  for (let index = 0; index < 5; index += 1) buffer.submit(expired);
  now.mockReturnValue(6001);
  const fresh = jest.fn();
  expect(buffer.submit(fresh)).toBe(true);
  publishNativeHydrationGate(owner, 'ready');
  expect(expired).not.toHaveBeenCalled();
  expect(fresh).toHaveBeenCalledTimes(1);
  buffer.dispose();
});

test.each(['degraded', 'retry-required', 'released', 'new-owner'] as const)(
  'clears startup presses after %s and never replays them in a recovered generation', reason => {
    const owner = acquireNativeHydrationGate();
    const buffer = createRemoteNavigationIntentBuffer();
    const run = jest.fn();
    buffer.submit(run);
    if (reason === 'released') releaseNativeHydrationGate(owner);
    else if (reason === 'new-owner') publishNativeHydrationGate(acquireNativeHydrationGate(), 'ready');
    else publishNativeHydrationGate(owner, reason);
    publishNativeHydrationGate(owner, 'ready');
    expect(run).not.toHaveBeenCalled();
    buffer.dispose();
  },
);

test.each(['degraded', 'retry-required'] as const)('rejects presses while the gate is %s', status => {
  const owner = acquireNativeHydrationGate();
  publishNativeHydrationGate(owner, status);
  const buffer = createRemoteNavigationIntentBuffer();
  const run = jest.fn();
  expect(buffer.submit(run)).toBe(false);
  publishNativeHydrationGate(owner, 'ready');
  expect(run).not.toHaveBeenCalled();
  buffer.dispose();
});

test('binds an unowned cold-start press to the first owner', () => {
  const buffer = createRemoteNavigationIntentBuffer();
  const run = jest.fn();
  buffer.submit(run);
  const owner = acquireNativeHydrationGate();
  expect(run).not.toHaveBeenCalled();
  publishNativeHydrationGate(owner, 'ready');
  expect(run).toHaveBeenCalledTimes(1);
  buffer.dispose();
});

test('does not rebind an unowned cold-start press to a subsequent owner', () => {
  const buffer = createRemoteNavigationIntentBuffer();
  const run = jest.fn();
  buffer.submit(run);
  acquireNativeHydrationGate();
  publishNativeHydrationGate(acquireNativeHydrationGate(), 'ready');
  expect(run).not.toHaveBeenCalled();
  buffer.dispose();
});

test('rechecks ownership between ready callbacks', () => {
  const owner = acquireNativeHydrationGate();
  const buffer = createRemoteNavigationIntentBuffer();
  const later = jest.fn();
  buffer.submit(() => releaseNativeHydrationGate(owner));
  buffer.submit(later);
  publishNativeHydrationGate(owner, 'ready');
  expect(later).not.toHaveBeenCalled();
  buffer.dispose();
});

test('clear cancels pending commands without preventing future presses', () => {
  const owner = acquireNativeHydrationGate();
  const buffer = createRemoteNavigationIntentBuffer();
  const old = jest.fn();
  const later = jest.fn();
  buffer.submit(old);
  buffer.clear();
  buffer.submit(later);
  publishNativeHydrationGate(owner, 'ready');
  expect(old).not.toHaveBeenCalled();
  expect(later).toHaveBeenCalledTimes(1);
  buffer.dispose();
});

test('dispose cancels pending commands, detaches the listener and rejects new presses', () => {
  const owner = acquireNativeHydrationGate();
  const buffer = createRemoteNavigationIntentBuffer();
  const run = jest.fn();
  buffer.submit(run);
  buffer.dispose();
  buffer.dispose();
  expect(buffer.submit(run)).toBe(false);
  publishNativeHydrationGate(owner, 'ready');
  expect(run).not.toHaveBeenCalled();
});

test('a startup navigation task awaits the native operation after hydration becomes ready', async () => {
  const owner = acquireNativeHydrationGate();
  const buffer = createRemoteNavigationIntentBuffer();
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const intent = buffer.submitWithCompletion(() => held);
  const settled = jest.fn();
  void intent.completion.then(settled);
  publishNativeHydrationGate(owner, 'ready');
  await Promise.resolve();
  expect(settled).not.toHaveBeenCalled();
  release();
  await intent.completion;
  expect(settled).toHaveBeenCalledTimes(1);
  buffer.dispose();
});

test('clear settles a replayed task and invalidates its queued callback without cancelling the native operation', async () => {
  const owner = acquireNativeHydrationGate();
  const buffer = createRemoteNavigationIntentBuffer();
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const intent = buffer.submitWithCompletion(() => held);
  publishNativeHydrationGate(owner, 'ready');
  expect(intent.isCurrent()).toBe(true);
  buffer.clear();
  await expect(intent.completion).resolves.toBeUndefined();
  expect(intent.isCurrent()).toBe(false);
  release();
  buffer.dispose();
});

test('a navigation task expires after five seconds without waiting for another gate event', async () => {
  jest.useFakeTimers();
  const owner = acquireNativeHydrationGate();
  const buffer = createRemoteNavigationIntentBuffer();
  const run = jest.fn();
  const intent = buffer.submitWithCompletion(run);
  jest.advanceTimersByTime(5_000);
  await expect(intent.completion).resolves.toBeUndefined();
  publishNativeHydrationGate(owner, 'ready');
  expect(run).not.toHaveBeenCalled();
  buffer.dispose();
});

test.each(['cleared', 'disposed', 'degraded', 'retry-required', 'released', 'new-owner'] as const)(
  'cancelled navigation tasks settle immediately after %s', async reason => {
    const owner = acquireNativeHydrationGate();
    const buffer = createRemoteNavigationIntentBuffer();
    const intent = buffer.submitWithCompletion(jest.fn());
    if (reason === 'cleared') buffer.clear();
    else if (reason === 'disposed') buffer.dispose();
    else if (reason === 'released') releaseNativeHydrationGate(owner);
    else if (reason === 'new-owner') acquireNativeHydrationGate();
    else publishNativeHydrationGate(owner, reason);
    await expect(intent.completion).resolves.toBeUndefined();
    buffer.dispose();
  },
);
