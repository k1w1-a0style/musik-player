import { OperationAbortError, throwIfAborted } from './withTimeout';

export const WAVEFORM_EXTRACTION_DEBOUNCE_MS = 120;
export const WAVEFORM_FAILURE_BACKOFF_MS = 30_000;
export const MAX_WAVEFORM_FAILURE_BACKOFF_ENTRIES = 80;
export const MAX_DETACHED_NATIVE_WAVEFORM_FLIGHTS = 2;

type NativeResult = {
  points: number[];
  durationMs?: number;
  analysis?: 'decoded-pcm-v1';
} | null;
type NativeOperation = (signal: AbortSignal) => Promise<NativeResult>;
export type WaveformExtractionPriority = 'foreground' | 'preload' | 'background';

interface WaveformScheduleOptions {
  priority?: WaveformExtractionPriority;
  rejoinDetached?: boolean;
}

export class WaveformSchedulerUnavailableError extends Error {
  constructor(message = 'Native waveform extraction is temporarily unavailable') {
    super(message);
    this.name = 'WaveformSchedulerUnavailableError';
  }
}

interface Pending {
  key: string;
  priority: WaveformExtractionPriority;
  operation: NativeOperation;
  readyAt: number;
  timer: ReturnType<typeof setTimeout> | null;
  promise: Promise<NativeResult>;
  resolve: (value: NativeResult) => void;
  reject: (reason: Error) => void;
  waiters: number;
  waiterPriorities: Map<WaveformExtractionPriority, number>;
  settled: boolean;
  generation: number;
}

interface Flight {
  key: string;
  promise: Promise<NativeResult>;
  pending: Pending;
  generation: number;
  detached: boolean;
  controller: AbortController;
}

interface FailureBackoff {
  expiresAt: number;
  reason: 'native-empty' | 'native-unsupported-analysis' | 'native-unusable-shape'
    | 'native-error' | 'native-timeout';
}

let lifecycleGeneration = 0;
let activeFlight: Flight | null = null;
let pendingLatest: Pending | null = null;
const detachedFlights = new Set<Flight>();
const failures = new Map<string, FailureBackoff>();

const clearPendingTimer = (pending: Pending): void => {
  if (pending.timer === null) return;
  clearTimeout(pending.timer);
  pending.timer = null;
};

const resolvePending = (pending: Pending, value: NativeResult): void => {
  if (pending.settled) return;
  pending.settled = true;
  clearPendingTimer(pending);
  pending.resolve(value);
};

const rejectPending = (pending: Pending, reason: Error): void => {
  if (pending.settled) return;
  pending.settled = true;
  clearPendingTimer(pending);
  pending.reject(reason);
};

const schedulerCapacityError = (): WaveformSchedulerUnavailableError =>
  new WaveformSchedulerUnavailableError(
    `Native waveform extraction paused after ${MAX_DETACHED_NATIVE_WAVEFORM_FLIGHTS} non-settling calls`,
  );

const findDetachedFlight = (sourceKey: string): Flight | undefined =>
  [...detachedFlights].find(flight => flight.key === sourceKey && !flight.pending.settled);

function armPending(pending: Pending): void {
  if (pendingLatest !== pending || pending.settled || activeFlight) return;
  if (detachedFlights.size >= MAX_DETACHED_NATIVE_WAVEFORM_FLIGHTS) {
    pendingLatest = null;
    rejectPending(pending, schedulerCapacityError());
    return;
  }

  const remainingMs = Math.max(0, pending.readyAt - Date.now());
  clearPendingTimer(pending);
  if (remainingMs === 0) {
    startPending(pending);
    return;
  }

  pending.timer = setTimeout(() => {
    pending.timer = null;
    startPending(pending);
  }, remainingMs);
}

function startPending(pending: Pending): void {
  if (pendingLatest !== pending || pending.settled || activeFlight) return;
  if (pending.generation !== lifecycleGeneration) {
    pendingLatest = null;
    rejectPending(pending, new OperationAbortError('Waveform lifecycle changed'));
    return;
  }
  if (Date.now() < pending.readyAt) {
    armPending(pending);
    return;
  }
  if (detachedFlights.size >= MAX_DETACHED_NATIVE_WAVEFORM_FLIGHTS) {
    pendingLatest = null;
    rejectPending(pending, schedulerCapacityError());
    return;
  }

  pendingLatest = null;
  const controller = new AbortController();
  const nativePromise = Promise.resolve().then(() => pending.operation(controller.signal));
  const flight: Flight = {
    key: pending.key,
    promise: nativePromise,
    pending,
    generation: pending.generation,
    detached: false,
    controller,
  };
  activeFlight = flight;

  void nativePromise
    .then(
      value => resolvePending(pending, value),
      error => rejectPending(pending, error instanceof Error ? error : new Error(String(error))),
    )
    .finally(() => {
      if (flight.generation !== lifecycleGeneration) return;
      if (flight.detached) detachedFlights.delete(flight);
      if (activeFlight === flight) activeFlight = null;
      if (pendingLatest) armPending(pendingLatest);
    });
}

const makePending = (
  key: string,
  operation: NativeOperation,
  priority: WaveformExtractionPriority,
): Pending => {
  let resolve!: Pending['resolve'];
  let reject!: Pending['reject'];
  const promise = new Promise<NativeResult>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    key,
    priority,
    operation,
    readyAt: Date.now() + WAVEFORM_EXTRACTION_DEBOUNCE_MS,
    timer: null,
    promise,
    resolve,
    reject,
    waiters: 0,
    waiterPriorities: new Map(),
    settled: false,
    generation: lifecycleGeneration,
  };
};

const detachActiveFlight = (flight: Flight): void => {
  if (activeFlight !== flight || flight.detached) return;
  activeFlight = null;
  flight.controller.abort(new OperationAbortError('Waveform request no longer needed'));
  flight.detached = true;
  detachedFlights.add(flight);

  if (detachedFlights.size >= MAX_DETACHED_NATIVE_WAVEFORM_FLIGHTS && pendingLatest) {
    const blocked = pendingLatest;
    pendingLatest = null;
    rejectPending(blocked, schedulerCapacityError());
    return;
  }

  if (pendingLatest) armPending(pendingLatest);
};

const priorityRank = (priority: WaveformExtractionPriority): number => {
  if (priority === 'foreground') return 2;
  if (priority === 'preload') return 1;
  return 0;
};

const preemptLowerPriorityFlight = (flight: Flight): void => {
  rejectPending(
    flight.pending,
    new OperationAbortError('Waveform work preempted by a higher-priority request'),
  );
  detachActiveFlight(flight);
};

const deferredPriorityError = (): WaveformSchedulerUnavailableError =>
  new WaveformSchedulerUnavailableError('Waveform work deferred behind a higher-priority request');

const addWaiterPriority = (pending: Pending, priority: WaveformExtractionPriority): void => {
  pending.waiterPriorities.set(priority, (pending.waiterPriorities.get(priority) ?? 0) + 1);
  if (priorityRank(priority) > priorityRank(pending.priority)) pending.priority = priority;
};

const removeWaiterPriority = (pending: Pending, priority: WaveformExtractionPriority): void => {
  const count = pending.waiterPriorities.get(priority) ?? 0;
  if (count <= 1) pending.waiterPriorities.delete(priority);
  else pending.waiterPriorities.set(priority, count - 1);

  if (pending.waiterPriorities.has('foreground')) pending.priority = 'foreground';
  else if (pending.waiterPriorities.has('preload')) pending.priority = 'preload';
  else pending.priority = 'background';
};

const awaitPending = (
  pending: Pending,
  signal: AbortSignal,
  priority: WaveformExtractionPriority,
): Promise<NativeResult> => {
  throwIfAborted(signal);
  pending.waiters += 1;
  addWaiterPriority(pending, priority);

  return new Promise<NativeResult>((resolve, reject) => {
    let settled = false;
    const finish = (): boolean => {
      if (settled) return false;
      settled = true;
      pending.waiters -= 1;
      removeWaiterPriority(pending, priority);
      signal.removeEventListener('abort', abort);
      return true;
    };
    const abort = () => {
      if (!finish()) return;
      reject(signal.reason instanceof Error ? signal.reason : new OperationAbortError());

      if (pending.waiters !== 0) return;
      if (pendingLatest === pending) {
        pendingLatest = null;
        rejectPending(pending, new OperationAbortError('Waveform request no longer needed'));
        return;
      }
      if (activeFlight?.pending === pending) detachActiveFlight(activeFlight);
    };

    signal.addEventListener('abort', abort, { once: true });
    pending.promise.then(
      value => { if (finish()) resolve(value); },
      error => { if (finish()) reject(error); },
    );
  });
};

/**
 * JS-side load control. The operation receives a per-flight AbortSignal so a
 * cancellation-capable native module can stop work promptly. Older native builds
 * are still protected by the bounded detached-flight fallback. An orphaned call is detached so
 * the latest song can continue, but detached work is bounded. A later request
 * for the same source rejoins the detached flight instead of starting a duplicate.
 * After two non-settling native calls the scheduler fails fast until one settles,
 * avoiding both a global waiter deadlock and unbounded native concurrency.
 * Higher-priority work can preempt a different lower-priority flight. The
 * ordering is visible foreground, likely-next preload, then previous/background.
 */
export const scheduleNativeWaveformExtraction = (
  sourceKey: string,
  operation: NativeOperation,
  signal: AbortSignal,
  options: WaveformScheduleOptions = {},
): Promise<NativeResult> => {
  throwIfAborted(signal);
  const priority = options.priority ?? 'foreground';
  if (activeFlight?.key === sourceKey) {
    return awaitPending(activeFlight.pending, signal, priority);
  }
  if (pendingLatest?.key === sourceKey) {
    return awaitPending(pendingLatest, signal, priority);
  }
  const detachedSameSource = options.rejoinDetached === false
    ? undefined
    : findDetachedFlight(sourceKey);
  if (detachedSameSource) {
    return awaitPending(detachedSameSource.pending, signal, priority);
  }

  if (activeFlight && priorityRank(priority) > priorityRank(activeFlight.pending.priority)) {
    preemptLowerPriorityFlight(activeFlight);
  }
  if (!activeFlight && detachedFlights.size >= MAX_DETACHED_NATIVE_WAVEFORM_FLIGHTS) {
    throw schedulerCapacityError();
  }

  if (pendingLatest) {
    if (priorityRank(priority) < priorityRank(pendingLatest.priority)) {
      return Promise.reject(deferredPriorityError());
    }
    const superseded = pendingLatest;
    pendingLatest = null;
    rejectPending(superseded, new OperationAbortError('Waveform request superseded'));
  }

  const pending = makePending(sourceKey, operation, priority);
  pendingLatest = pending;
  armPending(pending);
  return awaitPending(pending, signal, priority);
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
  lifecycleGeneration += 1;
  const resetError = new OperationAbortError('Waveform lifecycle reset');
  if (pendingLatest) rejectPending(pendingLatest, resetError);
  pendingLatest = null;
  if (activeFlight) {
    rejectPending(activeFlight.pending, resetError);
    activeFlight.controller.abort(resetError);
  }
  for (const flight of detachedFlights) {
    rejectPending(flight.pending, resetError);
    flight.controller.abort(resetError);
  }
  activeFlight = null;
  detachedFlights.clear();
  failures.clear();
};
