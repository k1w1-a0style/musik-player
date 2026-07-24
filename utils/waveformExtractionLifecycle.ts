import { OperationAbortError, throwIfAborted } from './withTimeout';

export const WAVEFORM_EXTRACTION_DEBOUNCE_MS = 120;
export const WAVEFORM_FAILURE_BACKOFF_MS = 30_000;
export const MAX_WAVEFORM_FAILURE_BACKOFF_ENTRIES = 80;

type NativeResult = { points: number[]; durationMs?: number } | null;
type NativeOperation = () => Promise<NativeResult>;

interface Flight {
  key: string;
  promise: Promise<NativeResult>;
}

interface Pending {
  key: string;
  operation: NativeOperation;
  timer: ReturnType<typeof setTimeout>;
  promise: Promise<NativeResult>;
  resolve: (value: NativeResult) => void;
  reject: (reason: Error) => void;
  waiters: number;
}

interface FailureBackoff {
  expiresAt: number;
  reason: 'native-empty' | 'native-unusable-shape' | 'native-error' | 'native-timeout';
}

let activeFlight: Flight | null = null;
let pendingLatest: Pending | null = null;
const failures = new Map<string, FailureBackoff>();

const rejectPending = (pending: Pending, message: string): void => {
  clearTimeout(pending.timer);
  pending.reject(new OperationAbortError(message));
};

const startPending = (pending: Pending): void => {
  if (pendingLatest !== pending || activeFlight) return;
  pendingLatest = null;
  const nativePromise = pending.operation();
  activeFlight = { key: pending.key, promise: nativePromise };
  nativePromise.then(pending.resolve, pending.reject).finally(() => {
    if (activeFlight?.promise === nativePromise) activeFlight = null;
    if (pendingLatest) startPending(pendingLatest);
  });
};

const makePending = (key: string, operation: NativeOperation): Pending => {
  let resolve!: Pending['resolve'];
  let reject!: Pending['reject'];
  const promise = new Promise<NativeResult>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const pending = {
    key,
    operation,
    promise,
    resolve,
    reject,
    waiters: 0,
    timer: undefined as unknown as ReturnType<typeof setTimeout>,
  };
  pending.timer = setTimeout(() => startPending(pending), WAVEFORM_EXTRACTION_DEBOUNCE_MS);
  return pending;
};

const awaitWithAbort = <T>(promise: Promise<T>, signal: AbortSignal): Promise<T> => {
  throwIfAborted(signal);
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason instanceof Error ? signal.reason : new OperationAbortError());
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
};

const awaitPending = (pending: Pending, signal: AbortSignal): Promise<NativeResult> => {
  pending.waiters += 1;
  throwIfAborted(signal);
  return new Promise<NativeResult>((resolve, reject) => {
    let settled = false;
    const finish = (): boolean => {
      if (settled) return false;
      settled = true;
      pending.waiters -= 1;
      signal.removeEventListener('abort', abort);
      return true;
    };
    const abort = () => {
      if (!finish()) return;
      reject(signal.reason instanceof Error ? signal.reason : new OperationAbortError());
      if (pending.waiters === 0 && pendingLatest === pending) {
        pendingLatest = null;
        rejectPending(pending, 'Waveform request no longer needed');
      }
    };
    signal.addEventListener('abort', abort, { once: true });
    pending.promise.then(
      value => { if (finish()) resolve(value); },
      error => { if (finish()) reject(error); },
    );
  });
};

/**
 * JS-only load control. Native work already in progress cannot be stopped by
 * the current Expo module contract, so it remains the active flight until it
 * settles. While it runs, only the latest different source is retained.
 */
export const scheduleNativeWaveformExtraction = (
  sourceKey: string,
  operation: NativeOperation,
  signal: AbortSignal,
): Promise<NativeResult> => {
  throwIfAborted(signal);
  if (activeFlight?.key === sourceKey) return awaitWithAbort(activeFlight.promise, signal);
  if (pendingLatest?.key === sourceKey) return awaitPending(pendingLatest, signal);

  if (pendingLatest) rejectPending(pendingLatest, 'Waveform request superseded');
  pendingLatest = makePending(sourceKey, operation);
  return awaitPending(pendingLatest, signal);
};

export const getWaveformFailureBackoff = (sourceKey: string): FailureBackoff['reason'] | null => {
  const failure = failures.get(sourceKey);
  if (!failure) return null;
  if (failure.expiresAt <= Date.now()) {
    failures.delete(sourceKey);
    return null;
  }
  return failure.reason;
};

export const recordWaveformFailure = (sourceKey: string, reason: FailureBackoff['reason']): void => {
  failures.delete(sourceKey);
  failures.set(sourceKey, { expiresAt: Date.now() + WAVEFORM_FAILURE_BACKOFF_MS, reason });
  while (failures.size > MAX_WAVEFORM_FAILURE_BACKOFF_ENTRIES) {
    const oldest = failures.keys().next().value as string | undefined;
    if (!oldest) break;
    failures.delete(oldest);
  }
};

export const clearWaveformFailure = (sourceKey: string): void => {
  failures.delete(sourceKey);
};

export const resetWaveformExtractionLifecycleForTests = (): void => {
  if (pendingLatest) rejectPending(pendingLatest, 'Waveform lifecycle reset');
  pendingLatest = null;
  activeFlight = null;
  failures.clear();
};
