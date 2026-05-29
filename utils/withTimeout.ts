export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class OperationAbortError extends Error {
  constructor(message = 'Operation aborted') {
    super(message);
    this.name = 'AbortError';
  }
}

export interface TimeoutOptions {
  signal?: AbortSignal;
}

export type CancellableOperation<T> = (signal: AbortSignal) => Promise<T>;

const getAbortReason = (signal: AbortSignal): unknown => signal.reason;

export const isTimeoutError = (error: unknown): error is TimeoutError => error instanceof TimeoutError;

export const isAbortError = (error: unknown): boolean =>
  error instanceof OperationAbortError
  || (error instanceof Error && error.name === 'AbortError');

export const throwIfAborted = (signal?: AbortSignal): void => {
  if (!signal?.aborted) return;
  const reason = getAbortReason(signal);
  if (reason instanceof Error) throw reason;
  throw new OperationAbortError(typeof reason === 'string' ? reason : undefined);
};

const abortErrorFromSignal = (signal: AbortSignal): Error => {
  const reason = getAbortReason(signal);
  if (reason instanceof Error) return reason;
  return new OperationAbortError(typeof reason === 'string' ? reason : undefined);
};

const abortController = (controller: AbortController, reason: Error): void => {
  if (!controller.signal.aborted) controller.abort(reason);
};

export const withTimeout = async <T>(
  operation: Promise<T> | CancellableOperation<T>,
  ms: number,
  message: string,
  options: TimeoutOptions = {},
): Promise<T> => {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let externalAbortListener: (() => void) | undefined;

  if (options.signal?.aborted) {
    throwIfAborted(options.signal);
  }

  try {
    const sourcePromise = typeof operation === 'function' ? operation(controller.signal) : operation;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const timeoutError = new TimeoutError(message);
        abortController(controller, timeoutError);
        reject(timeoutError);
      }, ms);
    });
    const abortPromise = new Promise<never>((_, reject) => {
      externalAbortListener = () => {
        if (!options.signal) return;
        const abortError = abortErrorFromSignal(options.signal);
        abortController(controller, abortError);
        reject(abortError);
      };
      options.signal?.addEventListener('abort', externalAbortListener, { once: true });
    });

    return await Promise.race([sourcePromise, timeoutPromise, abortPromise]);
  } finally {
    if (timer) clearTimeout(timer);
    if (options.signal && externalAbortListener) {
      options.signal.removeEventListener('abort', externalAbortListener);
    }
  }
};
