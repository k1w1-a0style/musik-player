export const NATIVE_PLAYBACK_DEADLINE_MS = 8_000;
export const NATIVE_QUEUE_DEADLINE_MS = 30_000;
export const NATIVE_NAVIGATION_DEADLINE_MS = 12_000;
export type NativePlaybackLane = 'queue' | 'control' | 'seek';
export interface NativePlaybackWatchdogSnapshot {
  status: 'idle' | 'quarantined' | 'retry-required';
  lane?: NativePlaybackLane;
}

export class NativePlaybackTimeoutError extends Error {
  constructor(readonly lane: NativePlaybackLane) {
    super(`Native ${lane} operation exceeded its response budget. The native writer remains held until settlement.`);
    this.name = 'NativePlaybackTimeoutError';
  }
}

export class NativePlaybackQuarantinedError extends Error {
  constructor() {
    super('Native playback is waiting for a timed-out operation to settle.');
    this.name = 'NativePlaybackQuarantinedError';
  }
}

interface ExpiredFlight { lane: NativePlaybackLane; settled: boolean }
const expiredFlights = new Set<ExpiredFlight>();
const listeners = new Set<() => void>();
let snapshot: NativePlaybackWatchdogSnapshot = { status: 'idle' };
let epoch = 0;
const publish = (): void => {
  const quarantined = [...expiredFlights].find(flight => !flight.settled);
  const expired = quarantined ?? [...expiredFlights][0];
  snapshot = expired ? { status: quarantined ? 'quarantined' : 'retry-required', lane: expired.lane }
    : { status: 'idle' };
  listeners.forEach(listener => listener());
};
export const getNativePlaybackWatchdogSnapshot = (): NativePlaybackWatchdogSnapshot => snapshot;
export const subscribeToNativePlaybackWatchdog = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const assertNativePlaybackNotQuarantined = (): void => {
  if (snapshot.status === 'quarantined') throw new NativePlaybackQuarantinedError();
};

/** Clear only after a fresh, verified hydration/readback; never releases a writer. */
export const acknowledgeNativePlaybackRecovery = (): boolean => {
  if (snapshot.status === 'quarantined') return false;
  expiredFlights.clear();
  publish();
  return true;
};

/**
 * The public result has a deadline, the settlement promise does not. Locks
 * MUST use settlement rather than result: a JS timeout cannot cancel RNTP.
 */
export const createNativePlaybackWatchdog = (lane: NativePlaybackLane,
  timeoutMs = lane === 'queue' ? NATIVE_QUEUE_DEADLINE_MS : NATIVE_PLAYBACK_DEADLINE_MS) => {
  assertNativePlaybackNotQuarantined();
  const flight: ExpiredFlight = { lane, settled: false };
  const capturedEpoch = epoch;
  let started = false;
  let expired = false;
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectTimeout!: (error: Error) => void;
  const timeout = new Promise<never>((_, reject) => { rejectTimeout = reject; });
  const assertCurrent = (): void => {
    if (expired) throw new NativePlaybackTimeoutError(lane);
  };
  return {
    isCurrent: () => !expired,
    assertCurrent,
    start: () => {
      assertCurrent();
      if (started || settled) return;
      started = true;
      // Waiting in a mutation chain or for another lane is not native work.
      timer = setTimeout(() => {
        expired = true;
        if (capturedEpoch === epoch) { expiredFlights.add(flight); publish(); }
        rejectTimeout(new NativePlaybackTimeoutError(lane));
      }, timeoutMs);
    },
    observe: <T>(settlement: Promise<T>): Promise<T> => {
      const observed = settlement.finally(() => {
        clearTimeout(timer);
        settled = true;
        flight.settled = true;
        if (expiredFlights.has(flight)) publish();
      });
      return Promise.race([observed, timeout]);
    },
  };
};

export const resetNativePlaybackWatchdogForTests = (): void => {
  epoch += 1;
  expiredFlights.clear();
  publish();
};
