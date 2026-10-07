import { getNativeHydrationGate, subscribeToNativeHydrationGate, type NativeHydrationGateSnapshot } from '../utils/nativeHydrationGate';
import type { DesiredPlaybackState } from '../utils/nativePlaybackIntent';

const REMOTE_INTENT_LIFETIME_MS = 5_000;
interface RemoteIntentSubmission { accepted: boolean; completion: Promise<void>; isCurrent: () => boolean }

/** Expiry completes the remote task without cancelling an executing native writer. */
export const createRemoteIntentCompletion = (run: () => unknown, lifetimeMs: number) => {
  let settled = false;
  let cancelled = false;
  let replayed = false;
  const createdAt = Date.now();
  let finish!: () => void;
  const completion = new Promise<void>(resolve => { finish = resolve; });
  const complete = (): void => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    finish();
  };
  const settle = (): void => { cancelled = true; complete(); };
  const timer = setTimeout(settle, lifetimeMs);
  const reject = (error: unknown): void => { console.warn('[PlaybackService] Buffered remote action failed', error); settle(); };
  return {
    completion,
    isSettled: (): boolean => settled,
    isCurrent: (): boolean => !cancelled && Date.now() - createdAt <= lifetimeMs,
    settle,
    replay: (): void => {
      if (settled || replayed) return;
      replayed = true;
      try { Promise.resolve(run()).then(complete, reject); }
      catch (error) { reject(error); }
    },
  };
};

interface BufferedIntent extends ReturnType<typeof createRemoteIntentCompletion> {
  desired: DesiredPlaybackState; createdAt: number; generation: number | null;
}

/** One transport intent, no stale track/index/seek commands retained across startup. */
export const createRemotePlaybackIntentBuffer = () => {
  let pending: BufferedIntent | null = null;
  let disposed = false;
  const active = new Set<BufferedIntent>();
  const clear = (): void => { active.forEach(intent => intent.settle()); active.clear(); pending = null; };
  const onGate = (gate: NativeHydrationGateSnapshot) => {
    if (!gate.owned || gate.status === 'degraded' || gate.status === 'retry-required') { clear(); return; }
    active.forEach(intent => { if (intent.generation !== null && intent.generation !== gate.generation) intent.settle(); });
    if (!pending) return;
    if (pending.isSettled() || Date.now() - pending.createdAt > REMOTE_INTENT_LIFETIME_MS) { clear(); return; }
    if (pending.generation === null) pending.generation = gate.generation;
    if (pending.generation !== gate.generation) { clear(); return; }
    if (gate.status !== 'ready') return;
    const intent = pending;
    pending = null;
    intent.replay();
  };
  const unsubscribe = subscribeToNativeHydrationGate(onGate);
  const submitWithCompletion = (desired: DesiredPlaybackState, run: (isCurrent: () => boolean) => unknown): RemoteIntentSubmission => {
    const gate = getNativeHydrationGate();
    if (pending && (pending.isSettled() || Date.now() - pending.createdAt > REMOTE_INTENT_LIFETIME_MS)) clear();
    if (disposed || gate.status === 'degraded' || gate.status === 'retry-required'
      || (pending?.desired === 'stopped' && desired !== 'stopped')) return { accepted: false, completion: Promise.resolve(), isCurrent: () => false };
    clear();
    const isCurrent = (): boolean => {
      const current = getNativeHydrationGate();
      return !disposed && intent.isCurrent() && current.status !== 'degraded' && current.status !== 'retry-required'
        && (intent.generation === null || (current.owned && current.generation === intent.generation));
    };
    const intent: BufferedIntent = { desired, createdAt: Date.now(), generation: gate.owned ? gate.generation : null,
      ...createRemoteIntentCompletion(() => run(isCurrent), REMOTE_INTENT_LIFETIME_MS) };
    active.add(intent);
    void intent.completion.then(() => { active.delete(intent); });
    pending = intent;
    if (gate.owned) onGate(gate);
    return { accepted: true, completion: intent.completion, isCurrent };
  };
  return {
    submit: (desired: DesiredPlaybackState, run: (isCurrent: () => boolean) => unknown): boolean => submitWithCompletion(desired, run).accepted,
    submitWithCompletion,
    hasPendingStop: (): boolean => pending?.desired === 'stopped' && !pending.isSettled()
      && Date.now() - pending.createdAt <= REMOTE_INTENT_LIFETIME_MS,
    dispose: (): void => { disposed = true; clear(); unsubscribe(); },
  };
};
