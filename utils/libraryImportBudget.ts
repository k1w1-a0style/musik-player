import { isTimeoutError, throwIfAborted, withTimeout, type CancellableOperation, type TimeoutOptions } from './withTimeout';

export const DEFAULT_IMPORT_FILE_TIMEOUT_MS = 15_000;
const MAX_FILE_READS_IN_FLIGHT = 2;
let fileReadsInFlight = 0;
let fileReadGeneration = 0;

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
};

export const withImportFileBudget = async <T>(operation: CancellableOperation<T>, signal?: AbortSignal,
  timeoutMs = DEFAULT_IMPORT_FILE_TIMEOUT_MS): Promise<T> => {
  throwIfAborted(signal);
  if (fileReadsInFlight >= MAX_FILE_READS_IN_FLIGHT) throw new ImportFileReadCapacityError();
  const generation = fileReadGeneration;
  fileReadsInFlight += 1;
  return withTimeout(childSignal => {
    const source = Promise.resolve().then(() => operation(childSignal));
    // The reservation is released only when the real source settles. A JS timer
    // cannot cancel a provider stream, and starting its replacement would leak
    // unbounded native reads across retries or overlapping imports.
    void source.then(() => undefined, () => undefined).then(() => {
      if (generation === fileReadGeneration) fileReadsInFlight = Math.max(0, fileReadsInFlight - 1);
    });
    return source;
  }, timeoutMs, 'Datei konnte innerhalb des Zeitlimits nicht gelesen werden.', { signal });
};

export interface ImportWorkerResult { processed: number; remaining: number; interrupted: boolean }

/** A timeout retires that worker. The remaining worker may finish healthy files
 * without accumulating detached calls; an unprocessed tail is reported. */
export const runImportFileWorkers = async <T, R = void>(items: T[], options: {
  signal?: AbortSignal;
  perFileTimeoutMs?: number;
  read: (item: T, signal: AbortSignal) => Promise<R>;
  onResult?: (result: R, item: T) => Promise<void>;
  onFailure: (item: T, error: unknown) => void;
}): Promise<ImportWorkerResult> => {
  let next = 0;
  let processed = 0;
  let interrupted = false;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      throwIfAborted(options.signal);
      const item = items[next++];
      let result: R;
      try {
        result = await withImportFileBudget(signal => options.read(item, signal), options.signal, options.perFileTimeoutMs);
      } catch (error) {
        throwIfAborted(options.signal);
        options.onFailure(item, error);
        processed += 1;
        if (isTimeoutError(error) || error instanceof ImportFileReadCapacityError) {
          interrupted = true;
          return;
        }
        continue;
      }
      // Durable storage is outside the native file-read deadline. Its failure
      // stops the import rather than masquerading as damaged metadata.
      await options.onResult?.(result, item);
      processed += 1;
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_FILE_READS_IN_FLIGHT, items.length) }, worker));
  throwIfAborted(options.signal);
  return { processed, remaining: items.length - next, interrupted };
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
  }
};
