import { getNativeHydrationGate, subscribeToNativeHydrationGate, type NativeHydrationGateSnapshot } from '../utils/nativeHydrationGate';
import type { DesiredPlaybackState } from '../utils/nativePlaybackIntent';

const REMOTE_INTENT_LIFETIME_MS = 10_000;
interface BufferedIntent { desired: DesiredPlaybackState; createdAt: number; generation: number | null; run: () => void }

/** One transport intent, no stale track/index/seek commands retained across startup. */
export const createRemotePlaybackIntentBuffer = () => {
  let pending: BufferedIntent | null = null;
  const onGate = (gate: NativeHydrationGateSnapshot) => {
    if (!pending) return;
    if (!gate.owned || gate.status === 'degraded' || gate.status === 'retry-required'
      || Date.now() - pending.createdAt > REMOTE_INTENT_LIFETIME_MS) { pending = null; return; }
    if (pending.generation === null) pending.generation = gate.generation;
    if (pending.generation !== gate.generation) { pending = null; return; }
    if (gate.status !== 'ready') return;
    const intent = pending;
    pending = null;
    intent.run();
  };
  const unsubscribe = subscribeToNativeHydrationGate(onGate);
  return {
    submit: (desired: DesiredPlaybackState, run: () => void): boolean => {
      const gate = getNativeHydrationGate();
      if (gate.status === 'degraded' || gate.status === 'retry-required') return false;
      if (pending?.desired === 'stopped' && desired !== 'stopped') return false;
      pending = { desired, run, createdAt: Date.now(), generation: gate.owned ? gate.generation : null };
      if (gate.owned) onGate(gate);
      return true;
    },
    hasPendingStop: (): boolean => pending?.desired === 'stopped'
      && Date.now() - pending.createdAt <= REMOTE_INTENT_LIFETIME_MS,
    dispose: () => { pending = null; unsubscribe(); },
  };
};
