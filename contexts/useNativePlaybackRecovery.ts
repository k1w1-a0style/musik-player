import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { getNativeHydrationGate, publishNativeHydrationGate, subscribeToNativeHydrationGate, type NativeHydrationGateStatus } from '../utils/nativeHydrationGate';
import { acknowledgeNativePlaybackRecovery, getNativePlaybackWatchdogSnapshot, subscribeToNativePlaybackWatchdog } from '../utils/nativePlaybackWatchdog';

/** Reuse the existing verified hydration retry instead of resetting a live writer. */
export const useNativePlaybackRecovery = (setStatus: Dispatch<SetStateAction<NativeHydrationGateStatus>>): void => {
  useEffect(() => {
    const onWatchdog = () => {
      if (getNativePlaybackWatchdogSnapshot().status !== 'quarantined') return;
      const gate = getNativeHydrationGate();
      if (gate.owned && gate.status !== 'retry-required') {
        publishNativeHydrationGate({ generation: gate.generation }, 'retry-required');
      }
      setStatus('retry-required');
    };
    onWatchdog();
    const unsubscribeWatchdog = subscribeToNativePlaybackWatchdog(onWatchdog);
    const unsubscribeGate = subscribeToNativeHydrationGate(gate => {
      if (gate.owned && gate.status === 'ready') acknowledgeNativePlaybackRecovery();
    });
    return () => { unsubscribeWatchdog(); unsubscribeGate(); };
  }, [setStatus]);
};
