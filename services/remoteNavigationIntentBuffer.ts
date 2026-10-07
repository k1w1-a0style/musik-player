import { getNativeHydrationGate, subscribeToNativeHydrationGate, type NativeHydrationGateSnapshot } from '../utils/nativeHydrationGate';
import { createRemoteIntentCompletion } from './remotePlaybackIntentBuffer';

const REMOTE_NAVIGATION_LIFETIME_MS = 5_000;
const MAX_REMOTE_NAVIGATION_INTENTS = 5;
interface BufferedNavigationIntent extends ReturnType<typeof createRemoteIntentCompletion> { createdAt: number; generation: number | null }

/** Preserve a few deliberate headset presses only for the current startup. */
export const createRemoteNavigationIntentBuffer = () => {
  let pending: BufferedNavigationIntent[] = [];
  let disposed = false;
  let cancellationRevision = 0;
  const active = new Set<BufferedNavigationIntent>();
  const clear = (): void => { cancellationRevision += 1; active.forEach(intent => intent.settle()); active.clear(); pending = []; };
  const discard = (intent: BufferedNavigationIntent): false => { intent.settle(); return false; };
  const isFresh = (intent: BufferedNavigationIntent): boolean => !intent.isSettled()
    && Date.now() - intent.createdAt <= REMOTE_NAVIGATION_LIFETIME_MS;
  const onGate = (gate: NativeHydrationGateSnapshot): void => {
    if (!gate.owned || gate.status === 'degraded' || gate.status === 'retry-required') { clear(); return; }
    active.forEach(intent => { if (intent.generation !== null && intent.generation !== gate.generation) intent.settle(); });
    pending = pending.filter(intent => {
      if (!isFresh(intent)) return discard(intent);
      if (intent.generation === null) intent.generation = gate.generation;
      return intent.generation === gate.generation || discard(intent);
    });
    if (gate.status !== 'ready') return;
    const intents = pending;
    pending = [];
    const replayRevision = cancellationRevision;
    for (const intent of intents) {
      const current = getNativeHydrationGate();
      if (disposed || replayRevision !== cancellationRevision || !current.owned
        || current.status !== 'ready' || current.generation !== intent.generation) { intents.forEach(item => item.settle()); return; }
      if (isFresh(intent)) intent.replay();
      else intent.settle();
    }
  };
  const unsubscribe = subscribeToNativeHydrationGate(onGate);
  const submitWithCompletion = (run: (isCurrent: () => boolean) => unknown) => {
    const gate = getNativeHydrationGate();
    if (disposed || gate.status === 'degraded' || gate.status === 'retry-required') return { accepted: false, completion: Promise.resolve(), isCurrent: () => false };
    pending = pending.filter(intent => isFresh(intent) || discard(intent));
    if (pending.length >= MAX_REMOTE_NAVIGATION_INTENTS) return { accepted: false, completion: Promise.resolve(), isCurrent: () => false };
    const submittedRevision = cancellationRevision;
    const isCurrent = (): boolean => {
      const current = getNativeHydrationGate();
      return !disposed && submittedRevision === cancellationRevision && intent.isCurrent() && current.owned && current.status === 'ready'
        && current.generation === intent.generation;
    };
    const intent: BufferedNavigationIntent = { createdAt: Date.now(), generation: gate.owned ? gate.generation : null,
      ...createRemoteIntentCompletion(() => run(isCurrent), REMOTE_NAVIGATION_LIFETIME_MS) };
    active.add(intent);
    void intent.completion.then(() => { active.delete(intent); });
    pending.push(intent);
    if (gate.owned) onGate(gate);
    return { accepted: true, completion: intent.completion, isCurrent };
  };
  return {
    submit: (run: (isCurrent: () => boolean) => unknown): boolean => submitWithCompletion(run).accepted,
    submitWithCompletion,
    clear,
    dispose: (): void => { disposed = true; clear(); unsubscribe(); },
  };
};
