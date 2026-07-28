import {
  acquireNativeHydrationGate, getNativeHydrationGate, isNativeHydrationReady,
  publishNativeHydrationGate, releaseNativeHydrationGate, resetNativeHydrationGateForTests,
} from '../nativeHydrationGate';

beforeEach(resetNativeHydrationGateForTests);

test('starts fail-closed and only the current owner can publish', () => {
  expect(getNativeHydrationGate()).toMatchObject({ status: 'loading', owned: false });
  expect(isNativeHydrationReady()).toBe(false);
  const oldOwner = acquireNativeHydrationGate();
  const currentOwner = acquireNativeHydrationGate();
  expect(publishNativeHydrationGate(oldOwner, 'ready')).toBe(false);
  expect(publishNativeHydrationGate(currentOwner, 'ready')).toBe(true);
  expect(isNativeHydrationReady()).toBe(true);
});

test('release is fail-closed and stale release cannot affect a new owner', () => {
  const oldOwner = acquireNativeHydrationGate();
  publishNativeHydrationGate(oldOwner, 'ready');
  const currentOwner = acquireNativeHydrationGate();
  publishNativeHydrationGate(currentOwner, 'ready');
  expect(releaseNativeHydrationGate(oldOwner)).toBe(false);
  expect(isNativeHydrationReady()).toBe(true);
  expect(releaseNativeHydrationGate(currentOwner)).toBe(true);
  expect(getNativeHydrationGate()).toMatchObject({ status: 'loading', owned: false });
});
