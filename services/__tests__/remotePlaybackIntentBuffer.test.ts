import { createRemotePlaybackIntentBuffer } from '../remotePlaybackIntentBuffer';
import { acquireNativeHydrationGate, publishNativeHydrationGate, releaseNativeHydrationGate, resetNativeHydrationGateForTests } from '../../utils/nativeHydrationGate';

beforeEach(() => { resetNativeHydrationGateForTests(); jest.restoreAllMocks(); });

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
