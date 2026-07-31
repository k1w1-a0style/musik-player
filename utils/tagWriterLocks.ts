const writeLocksByUri = new Map<string, Promise<void>>();

export type SafWritePhase = 'accepted' | 'lockAcquired' | 'nativeMutationStarted' | 'pendingNativeResult' | 'completed' | 'failed' | 'cancelledBeforeMutation';
export type SafWriteOperationStatus = {
  operationId: string;
  targetKey: string;
  phase: SafWritePhase;
  terminal: boolean;
  retryable: boolean;
};
type SafWriteOperationOptions<T> = {
  timeoutMs?: number;
  operationId?: string;
  phaseForResult?: (value: T) => Extract<SafWritePhase, 'completed' | 'failed'>;
};

const activeSafWrites = new Map<string, SafWriteOperationStatus>();
let operationSequence = 0;

export const canonicalSafTarget = (uri: string): string => {
  const trimmed = uri.trim();
  const separator = trimmed.indexOf('://');
  if (separator < 0) return trimmed;
  return `${trimmed.slice(0, separator).toLowerCase()}://${trimmed.slice(separator + 3)}`;
};

export const createTagWriteOperationId = (): string =>
  `tag-${Date.now().toString(36)}-${(++operationSequence).toString(36)}`;

export const getActiveSafWrite = (uri: string): SafWriteOperationStatus | undefined => {
  const value = activeSafWrites.get(canonicalSafTarget(uri));
  return value ? { ...value } : undefined;
};

export const runSafWriteOperation = async <T>(
  uri: string,
  startNativeMutation: (operationId: string) => Promise<T>,
  options: SafWriteOperationOptions<T> = {},
): Promise<{ kind: 'result'; value: T; status: SafWriteOperationStatus } | { kind: 'pending'; status: SafWriteOperationStatus } | { kind: 'busy'; status: SafWriteOperationStatus }> => {
  const targetKey = canonicalSafTarget(uri);
  const existing = activeSafWrites.get(targetKey);
  if (existing) return { kind: 'busy', status: { ...existing } };

  const status: SafWriteOperationStatus = {
    operationId: options.operationId ?? createTagWriteOperationId(), targetKey,
    phase: 'accepted', terminal: false, retryable: false,
  };
  activeSafWrites.set(targetKey, status);
  status.phase = 'lockAcquired';

  if (options.timeoutMs !== undefined && options.timeoutMs <= 0) {
    status.phase = 'cancelledBeforeMutation'; status.terminal = true; status.retryable = true;
    activeSafWrites.delete(targetKey);
    return { kind: 'result', value: undefined as T, status: { ...status } };
  }

  status.phase = 'nativeMutationStarted';
  const nativePromise = Promise.resolve().then(() => startNativeMutation(status.operationId));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const settled = nativePromise.then(
    value => ({ ok: true as const, value }),
    error => ({ ok: false as const, error }),
  );
  if (options.timeoutMs === undefined) {
    const outcome = await settled;
    status.phase = outcome.ok ? (options.phaseForResult?.(outcome.value) ?? 'completed') : 'failed'; status.terminal = true; status.retryable = !outcome.ok;
    activeSafWrites.delete(targetKey);
    if (!outcome.ok) throw outcome.error;
    return { kind: 'result', value: outcome.value, status: { ...status } };
  }

  const timeout = new Promise<{ timeout: true }>(resolve => { timer = setTimeout(() => resolve({ timeout: true }), options.timeoutMs); });
  const first = await Promise.race([settled, timeout]);
  if ('timeout' in first) {
    status.phase = 'pendingNativeResult'; status.retryable = false;
    void settled.then(outcome => {
      status.phase = outcome.ok ? (options.phaseForResult?.(outcome.value) ?? 'completed') : 'failed'; status.terminal = true; status.retryable = !outcome.ok;
      activeSafWrites.delete(targetKey);
    });
    return { kind: 'pending', status: { ...status } };
  }
  if (timer) clearTimeout(timer);
  status.phase = first.ok ? (options.phaseForResult?.(first.value) ?? 'completed') : 'failed'; status.terminal = true; status.retryable = !first.ok;
  activeSafWrites.delete(targetKey);
  if (!first.ok) throw first.error;
  return { kind: 'result', value: first.value, status: { ...status } };
};

/**
 * Serializes tag writes per URI. Callers must always await this promise;
 * fire-and-forget usage is forbidden because it can release UI/persistence flows
 * before native file replacement has settled. The callback must not
 * intentionally start concurrent writes for the same URI outside this lock.
 */
export const withUriWriteLock = async <T>(
  uri: string,
  operation: () => Promise<T>,
): Promise<T> => {
  const previous = writeLocksByUri.get(uri) ?? Promise.resolve();
  let releaseCurrent: (() => void) | undefined;
  const current = new Promise<void>(resolve => {
    releaseCurrent = resolve;
  });
  const queueTail = previous.then(() => current);
  writeLocksByUri.set(uri, queueTail);
  await previous;
  try {
    return await operation();
  } finally {
    releaseCurrent?.();
    if (writeLocksByUri.get(uri) === queueTail) writeLocksByUri.delete(uri);
  }
};
