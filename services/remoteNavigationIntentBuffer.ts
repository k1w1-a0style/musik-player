import { getNativeHydrationGate, subscribeToNativeHydrationGate, type NativeHydrationGateSnapshot } from '../utils/nativeHydrationGate';

const REMOTE_NAVIGATION_LIFETIME_MS = 5_000;
const MAX_REMOTE_NAVIGATION_INTENTS = 5;
interface BufferedNavigationIntent { createdAt: number; generation: number | null; run: () => void }

/** Preserve a few deliberate headset presses only for the current startup. */
export const createRemoteNavigationIntentBuffer = () => {
  let pending: BufferedNavigationIntent[] = [];
  let disposed = false;
  const clear = (): void => { pending = []; };
  const onGate = (gate: NativeHydrationGateSnapshot): void => {
    if (!gate.owned || gate.status === 'degraded' || gate.status === 'retry-required') { clear(); return; }
    pending = pending.filter(intent => {
      if (Date.now() - intent.createdAt > REMOTE_NAVIGATION_LIFETIME_MS) return false;
      if (intent.generation === null) intent.generation = gate.generation;
      return intent.generation === gate.generation;
    });
    if (gate.status !== 'ready') return;
    const intents = pending;
    clear();
    for (const intent of intents) {
      const current = getNativeHydrationGate();
      if (disposed || !current.owned || current.status !== 'ready' || current.generation !== intent.generation) return;
      if (Date.now() - intent.createdAt <= REMOTE_NAVIGATION_LIFETIME_MS) intent.run();
    }
  };
  const unsubscribe = subscribeToNativeHydrationGate(onGate);
  return {
    submit: (run: () => void): boolean => {
      const gate = getNativeHydrationGate();
      if (disposed || gate.status === 'degraded' || gate.status === 'retry-required') return false;
      pending = pending.filter(intent => Date.now() - intent.createdAt <= REMOTE_NAVIGATION_LIFETIME_MS);
      if (pending.length >= MAX_REMOTE_NAVIGATION_INTENTS) return false;
      pending.push({ run, createdAt: Date.now(), generation: gate.owned ? gate.generation : null });
      if (gate.owned) onGate(gate);
      return true;
    },
    clear,
    dispose: (): void => { disposed = true; clear(); unsubscribe(); },
  };
};
