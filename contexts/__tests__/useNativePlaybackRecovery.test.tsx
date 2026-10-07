import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useMusicProviderState } from '../useMusicProviderState';
import { acquireNativeHydrationGate, getNativeHydrationGate, publishNativeHydrationGate, resetNativeHydrationGateForTests } from '../../utils/nativeHydrationGate';
import { resetNativeQueueMutationLockForTests, runExclusiveNativeQueueReplacement } from '../../utils/nativeQueueMutationLock';
import { getNativePlaybackWatchdogSnapshot } from '../../utils/nativePlaybackWatchdog';

beforeEach(() => { resetNativeQueueMutationLockForTests(); resetNativeHydrationGateForTests(); });

test('quarantine closes hydration and only a verified ready publication clears recovery', async () => {
  jest.useFakeTimers();
  const owner = acquireNativeHydrationGate(); publishNativeHydrationGate(owner, 'ready');
  const hook = renderHook(() => useMusicProviderState());
  let started!: () => void; let release!: () => void;
  const began = new Promise<void>(resolve => { started = resolve; });
  const operation = runExclusiveNativeQueueReplacement(async context => {
    context.beginNativeMutation(); started(); await new Promise<void>(resolve => { release = resolve; });
  }, { timeoutMs: 40 });
  const outcome = operation.catch(error => error);
  await began;
  await act(async () => { await jest.advanceTimersByTimeAsync(40); await outcome; });
  expect(hook.result.current.hydrationStatus).toBe('retry-required');
  expect(getNativeHydrationGate().status).toBe('retry-required');
  expect(getNativePlaybackWatchdogSnapshot().status).toBe('quarantined');
  release(); await act(async () => { await jest.advanceTimersByTimeAsync(0); });
  expect(getNativePlaybackWatchdogSnapshot().status).toBe('retry-required');
  await act(async () => { publishNativeHydrationGate(owner, 'ready'); });
  await waitFor(() => expect(getNativePlaybackWatchdogSnapshot().status).toBe('idle'));
  hook.unmount(); jest.useRealTimers();
});
