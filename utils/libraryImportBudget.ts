import { isTimeoutError, throwIfAborted, withTimeout, type CancellableOperation, type TimeoutOptions } from './withTimeout';

export const DEFAULT_IMPORT_FILE_TIMEOUT_MS = 15_000;
const MAX_FILE_READS_IN_FLIGHT = 2;
let fileReadsInFlight = 0;
let fileReadGeneration = 0;
const capacityListeners = new Set<() => void>();

export class ImportFileReadCapacityError extends Error {
  constructor() {
    super('Dateianbieter ist noch beschäftigt. Scan nach Abschluss der laufenden Lesezugriffe wiederholen.');
    this.name = 'ImportFileReadCapacityError';
  }
}

/** Reset only in tests; a real timeout must retain its native read reservation. */
export const resetImportFileReadsForTests = (): void => {
  fileReadGeneration += 1;
  fileReadsInFlight = 0;
  capacityListeners.clear();
};

export const withImportFileBudget = async <T>(operation: (signal: AbortSignal, activity: () => void) => Promise<T>, signal?: AbortSignal,
  timeoutMs = DEFAULT_IMPORT_FILE_TIMEOUT_MS): Promise<T> => {
  throwIfAborted(signal);
  if (fileReadsInFlight >= MAX_FILE_READS_IN_FLIGHT) throw new ImportFileReadCapacityError();
  const generation = fileReadGeneration;
  fileReadsInFlight += 1;
  return withImportInactivityTimeout((childSignal, activity) => {
    const source = Promise.resolve().then(() => operation(childSignal, activity));
    // The reservation is released only when the real source settles. A JS timer
    // cannot cancel a provider stream, and starting its replacement would leak
    // unbounded native reads across retries or overlapping imports.
    void source.then(() => undefined, () => undefined).then(() => {
      if (generation === fileReadGeneration) {
        fileReadsInFlight = Math.max(0, fileReadsInFlight - 1);
        capacityListeners.forEach(listener => listener());
      }
    });
    return source;
  }, timeoutMs, 'Datei konnte innerhalb des Zeitlimits nicht gelesen werden.', { signal });
};

export interface ImportWorkerResult { processed: number; remaining: number; interrupted: boolean }

/** Wait for actual settlement, without polling or freeing a detached read. The
 * existing inactivity budget also bounds recovery from a blocked provider. */
const waitForImportCapacity = async (signal: AbortSignal | undefined, timeoutMs: number): Promise<boolean> => {
  throwIfAborted(signal);
  if (fileReadsInFlight < MAX_FILE_READS_IN_FLIGHT) return true;
  let notify: (() => void) | undefined;
  try {
    return await withTimeout(() => new Promise<boolean>(resolve => {
      notify = () => { if (fileReadsInFlight < MAX_FILE_READS_IN_FLIGHT) resolve(true); };
      capacityListeners.add(notify);
      notify();
    }), timeoutMs, 'Dateianbieter blockiert weiterhin laufende Lesezugriffe.', { signal });
  } catch (error) {
    throwIfAborted(signal);
    if (isTimeoutError(error)) return false;
    throw error;
  } finally {
    if (notify) capacityListeners.delete(notify);
  }
};

/** Keep working after a timeout once real capacity returns. Claim a file only
 * after reserving capacity, so an occupied provider never consumes the tail. */
export const runImportFileWorkers = async <T, R = void>(items: T[], options: {
  signal?: AbortSignal;
  perFileTimeoutMs?: number;
  read: (item: T, signal: AbortSignal, activity: () => void) => Promise<R>;
  onResult?: (result: R, item: T) => Promise<void>;
  onFailure: (item: T, error: unknown) => void;
}): Promise<ImportWorkerResult> => {
  const controller = new AbortController();
  const signal = controller.signal;
  const abort = (): void => { controller.abort(options.signal?.reason); };
  if (options.signal?.aborted) abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  let next = 0;
  let processed = 0;
  const timeoutMs = options.perFileTimeoutMs ?? DEFAULT_IMPORT_FILE_TIMEOUT_MS;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      throwIfAborted(signal);
      if (!await waitForImportCapacity(signal, timeoutMs)) return;
      let index = -1;
      let result!: R;
      try {
        await withImportFileBudget(async (signal, activity) => {
          if (next >= items.length) return;
          index = next++;
          result = await options.read(items[index], signal, activity);
        }, signal, timeoutMs);
      } catch (error) {
        throwIfAborted(signal);
        if (index < 0) {
          if (error instanceof ImportFileReadCapacityError) continue;
          throw error;
        }
        options.onFailure(items[index], error);
        processed += 1;
        continue;
      }
      if (index < 0) return;
      // Durable storage is outside the native file-read deadline. Its failure
      // stops the import rather than masquerading as damaged metadata.
      await options.onResult?.(result, items[index]);
      processed += 1;
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(MAX_FILE_READS_IN_FLIGHT, items.length) }, worker));
    throwIfAborted(signal);
    return { processed, remaining: items.length - next, interrupted: next < items.length };
  } catch (error) {
    // A failed durable acknowledgement is terminal for the whole batch. Other
    // readers retain raw reservations but cannot start or publish further work.
    controller.abort(error);
    throw error;
  } finally {
    options.signal?.removeEventListener('abort', abort);
  }
};

type TimeoutRunner = <T>(operation: Promise<T> | CancellableOperation<T>, timeoutMs: number,
  message: string, options?: TimeoutOptions) => Promise<T>;

/** Reset the wait budget only on real scan/file progress. Large healthy imports
 * can exceed 90s; a stuck operation still aborts, including late callbacks. */
export const withImportInactivityTimeout = async <T>(
  operation: (signal: AbortSignal, activity: () => void) => Promise<T>,
  timeoutMs: number,
  message: string,
  options: TimeoutOptions = {},
  timeoutRunner: TimeoutRunner = withTimeout,
): Promise<T> => {
  throwIfAborted(options.signal);
  const controller = new AbortController();
  // Relay synchronously: a resolved native read must observe cancellation
  // before it can start a follow-up read or copy in the next microtask.
  const abort = (): void => { controller.abort(options.signal?.reason); };
  options.signal?.addEventListener('abort', abort, { once: true });
  let signalActivity: (() => void) | undefined;
  let closed = false;
  const activity = (): void => { if (!closed) signalActivity?.(); };
  const source = operation(controller.signal, activity).then(
    value => ({ kind: 'value' as const, value }),
    error => ({ kind: 'error' as const, error }),
  );
  try {
    while (true) {
      const progress = new Promise<{ kind: 'progress' }>(resolve => {
        signalActivity = () => resolve({ kind: 'progress' });
      });
      const result = await timeoutRunner(() => Promise.race([source, progress]), timeoutMs, message, options);
      if (result.kind === 'value') return result.value;
      if (result.kind === 'error') throw result.error;
    }
  } catch (error) {
    controller.abort(error);
    throw error;
  } finally {
    closed = true;
    signalActivity = undefined;
    options.signal?.removeEventListener('abort', abort);
  }
};
