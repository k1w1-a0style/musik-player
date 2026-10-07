import { createRemotePlaybackIntentBuffer } from '../remotePlaybackIntentBuffer';
import { acquireNativeHydrationGate, publishNativeHydrationGate, releaseNativeHydrationGate, resetNativeHydrationGateForTests } from '../../utils/nativeHydrationGate';

beforeEach(() => { resetNativeHydrationGateForTests(); jest.restoreAllMocks(); });
afterEach(() => jest.useRealTimers());

test('cold-start play/pause stores just the final intent', () => {
  const owner = acquireNativeHydrationGate(); const buffer = createRemotePlaybackIntentBuffer();
  const play = jest.fn(); const pause = jest.fn();
  buffer.submit('playing', play); buffer.submit('paused', pause);
  publishNativeHydrationGate(owner, 'ready');
  expect(play).not.toHaveBeenCalled(); expect(pause).toHaveBeenCalledTimes(1);
  buffer.dispose();
});

test('startup stop has priority over buffered play', () => {
  const owner = acquireNativeHydrationGate(); const buffer = createRemotePlaybackIntentBuffer();
  const stop = jest.fn(); const play = jest.fn();
  buffer.submit('stopped', stop);
  expect(buffer.submit('playing', play)).toBe(false);
  publishNativeHydrationGate(owner, 'ready');
  expect(stop).toHaveBeenCalledTimes(1); expect(play).not.toHaveBeenCalled();
  expect(buffer.hasPendingStop()).toBe(false);
  buffer.dispose();
});

test('pending stop blocks startup navigation only within its lifetime', () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
  acquireNativeHydrationGate();
  const buffer = createRemotePlaybackIntentBuffer();
  buffer.submit('stopped', jest.fn());
  expect(buffer.hasPendingStop()).toBe(true);
  now.mockReturnValue(11_001);
  expect(buffer.hasPendingStop()).toBe(false);
  buffer.dispose();
});

test.each(['degraded', 'retry-required', 'released', 'new-owner', 'expired'] as const)(
  'discards buffered play when startup is %s', reason => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
    const owner = acquireNativeHydrationGate(); const buffer = createRemotePlaybackIntentBuffer(); const play = jest.fn();
    buffer.submit('playing', play);
    if (reason === 'released') releaseNativeHydrationGate(owner);
    else if (reason === 'new-owner') acquireNativeHydrationGate();
    else if (reason === 'expired') now.mockReturnValue(11_001);
    else publishNativeHydrationGate(owner, reason);
    publishNativeHydrationGate(owner, 'ready');
    expect(play).not.toHaveBeenCalled();
    buffer.dispose();
  },
);

test('unowned headset cold-start binds to the first hydration owner only', () => {
  const buffer = createRemotePlaybackIntentBuffer(); const play = jest.fn();
  buffer.submit('playing', play);
  publishNativeHydrationGate(acquireNativeHydrationGate(), 'ready');
  expect(play).toHaveBeenCalledTimes(1);
  buffer.dispose();
});

test('a replaced transport task settles without replay and the current task waits for native completion', async () => {
  const owner = acquireNativeHydrationGate();
  const buffer = createRemotePlaybackIntentBuffer();
  const old = buffer.submitWithCompletion('playing', jest.fn());
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const current = buffer.submitWithCompletion('paused', () => held);
  await expect(old.completion).resolves.toBeUndefined();
  expect(old.isCurrent()).toBe(false);
  const settled = jest.fn();
  void current.completion.then(settled);
  publishNativeHydrationGate(owner, 'ready');
  await Promise.resolve();
  expect(settled).not.toHaveBeenCalled();
  release();
  await current.completion;
  expect(settled).toHaveBeenCalledTimes(1);
  buffer.dispose();
});

test('transport tasks expire and become invalid after five seconds without a gate event', async () => {
  jest.useFakeTimers();
  const owner = acquireNativeHydrationGate();
  const buffer = createRemotePlaybackIntentBuffer();
  const run = jest.fn();
  const intent = buffer.submitWithCompletion('playing', run);
  jest.advanceTimersByTime(5_000);
  await expect(intent.completion).resolves.toBeUndefined();
  expect(intent.isCurrent()).toBe(false);
  publishNativeHydrationGate(owner, 'ready');
  expect(run).not.toHaveBeenCalled();
  buffer.dispose();
});

test.each(['degraded', 'retry-required', 'released', 'new-owner', 'disposed'] as const)(
  'cancelled transport tasks settle immediately after %s', async reason => {
    const owner = acquireNativeHydrationGate();
    const buffer = createRemotePlaybackIntentBuffer();
    const intent = buffer.submitWithCompletion('playing', jest.fn());
    if (reason === 'disposed') buffer.dispose();
    else if (reason === 'released') releaseNativeHydrationGate(owner);
    else if (reason === 'new-owner') acquireNativeHydrationGate();
    else publishNativeHydrationGate(owner, reason);
    await expect(intent.completion).resolves.toBeUndefined();
    expect(intent.isCurrent()).toBe(false);
    buffer.dispose();
  },
);
