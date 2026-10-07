import { DEFAULT_LIBRARY_NATIVE_READ_TIMEOUT_MS } from './libraryOperationTimeouts';
import { isTimeoutError, throwIfAborted, withTimeout } from './withTimeout';

export type NativeReadOutcome<T> =
  | { kind: 'success'; value: T }
  | { kind: 'failure' }
  | { kind: 'timeout' };

interface NativeReadTimeoutOptions<T> {
  timeoutMs?: number;
  signal?: AbortSignal;
  label: string;
  onDiscard?: (value: T) => void;
}

const resolveNativeReadTimeoutMs = (value?: number): number =>
  Number.isFinite(value)
    ? Math.max(1, Math.floor(value as number))
    : DEFAULT_LIBRARY_NATIVE_READ_TIMEOUT_MS;

/**
 * Bounds how long JavaScript waits for a read-only native operation. Android
 * providers cannot always be interrupted once entered, so callers must stop
 * starting additional native reads on the same worker after `timeout`.
 */
export const runNativeReadWithTimeout = async <T>(
  operation: () => Promise<T>,
  options: NativeReadTimeoutOptions<T>,
): Promise<NativeReadOutcome<T>> => {
  const timeoutMs = resolveNativeReadTimeoutMs(options.timeoutMs);
  try {
    const value = await withTimeout(
      async signal => {
        const result = await operation();
        if (signal.aborted) {
          // A feature deadline may precede the module's own safety deadline.
          // Returned resources then have no consumer and must be released.
          options.onDiscard?.(result);
          throwIfAborted(signal);
        }
        return result;
      },
      timeoutMs,
      `${options.label} timed out after ${timeoutMs}ms.`,
      { signal: options.signal },
    );
    return { kind: 'success', value };
  } catch (error) {
    throwIfAborted(options.signal);
    return isTimeoutError(error) ? { kind: 'timeout' } : { kind: 'failure' };
  }
};
