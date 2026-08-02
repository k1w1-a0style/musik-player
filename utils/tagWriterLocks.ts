import AsyncStorage from '@react-native-async-storage/async-storage';

const writeLocksByUri = new Map<string, Promise<void>>();
const OPERATION_STORAGE_KEY = '@musik-player/tag-write-operations/v1';

export type SafWritePhase = 'accepted' | 'lockAcquired' | 'nativeMutationStarted' | 'pendingNativeResult' | 'completed' | 'failed' | 'cancelledBeforeMutation';
export type SafWriteOperationStatus = {
  operationId: string;
  targetKey: string;
  phase: SafWritePhase;
  terminal: boolean;
  retryable: boolean;
  blockedByOperationId?: string;
  operationStatus: 'completed' | 'pending' | 'recovery-pending' | 'failed';
  updatedAt: number;
  errorCode?: string;
  /** Native commit is known, but its completed journal record is not durable yet. */
  commitConfirmed?: boolean;
};
type SafWriteOperationOptions<T> = {
  timeoutMs?: number;
  operationId?: string;
  phaseForResult?: (value: T) => Extract<SafWritePhase, 'completed' | 'failed'>;
  recoveryPendingForResult?: (value: T) => boolean;
};

const activeSafWrites = new Map<string, SafWriteOperationStatus>();
const safWriteOperationsById = new Map<string, SafWriteOperationStatus>();
let persistenceQueue = Promise.resolve();
const durableTerminalOperations = new Map<string, SafWriteOperationStatus>();
let operationSequence = 0;
let startupState: 'pending' | 'ready' | 'failed' = process.env.NODE_ENV === 'test' ? 'ready' : 'pending';
let startupError: unknown;
let resolveStartup: (() => void) | undefined;
let startupBarrier = startupState === 'ready' ? Promise.resolve() : new Promise<void>(resolve => { resolveStartup = resolve; });

/** Closes the API gate before persisted ownership is read. Safe to call again for a retry. */
export const beginSafWriteStartupRestoration = (): void => {
  if (startupState === 'pending') return;
  startupState = 'pending';
  startupError = undefined;
  startupBarrier = new Promise<void>(resolve => { resolveStartup = resolve; });
};

export const finishSafWriteStartupRestoration = (error?: unknown): void => {
  if (startupState !== 'pending') return;
  startupState = error === undefined ? 'ready' : 'failed';
  startupError = error;
  resolveStartup?.();
  resolveStartup = undefined;
};

export const isSafWriteStartupReady = (): boolean => startupState === 'ready';

const awaitSafWriteStartup = async (): Promise<void> => {
  if (startupState === 'ready') return;
  await startupBarrier;
  if (startupState === 'failed') {
    throw new Error(`SAF tag writes are unavailable until startup restoration succeeds: ${String(startupError)}`);
  }
};

export const canonicalSafTarget = (uri: string): string => {
  const trimmed = uri.trim();
  const separator = trimmed.indexOf('://');
  if (separator < 0) return trimmed;
  const scheme = trimmed.slice(0, separator).toLowerCase();
  const remainder = trimmed.slice(separator + 3);
  if (scheme !== 'content') return `${scheme}://${remainder}`;
  try {
    const slash = remainder.indexOf('/');
    const authority = (slash < 0 ? remainder : remainder.slice(0, slash)).toLowerCase();
    const path = decodeURIComponent(slash < 0 ? '' : remainder.slice(slash));
    const marker = '/document/';
    const documentAt = path.lastIndexOf(marker);
    if (!authority) return 'content://unknown-target';
    if (documentAt < 0) return `content://${authority}${path}`;
    return `content://${authority}${marker}${path.slice(documentAt + marker.length)}`;
  } catch {
    // Unknown identities deliberately collide: malformed targets must fail closed.
    return 'content://unknown-target';
  }
};

export const createTagWriteOperationId = (): string =>
  `tag-${Date.now().toString(36)}-${(++operationSequence).toString(36)}`;

export const getActiveSafWrite = (uri: string): SafWriteOperationStatus | undefined => {
  const value = activeSafWrites.get(canonicalSafTarget(uri));
  return value ? { ...value } : undefined;
};

export const getSafWriteOperation = (operationId: string): SafWriteOperationStatus | undefined => {
  const value = safWriteOperationsById.get(operationId);
  return value ? { ...value } : undefined;
};

const persistOperations = async (overrides: SafWriteOperationStatus[] = []): Promise<void> => {
  persistenceQueue = persistenceQueue.catch(() => undefined).then(async () => {
    // Capture at execution time, not enqueue time. Completed records that have
    // already reached storage are monotonic and can never be overwritten by a
    // stale pending snapshot queued while their write was in flight.
    const records = new Map([...safWriteOperationsById.values()].map(status => [status.operationId, { ...status }]));
    for (const status of overrides) records.set(status.operationId, { ...status });
    for (const status of durableTerminalOperations.values()) records.set(status.operationId, { ...status });
    const snapshot = [...records.values()].slice(-50);
    await AsyncStorage.setItem(OPERATION_STORAGE_KEY, JSON.stringify(snapshot));
    for (const status of overrides) {
      if (status.terminal) durableTerminalOperations.set(status.operationId, { ...status });
    }
  });
  await persistenceQueue;
};

const persistObserved = (operation: Promise<void>): void => {
  void operation.catch(error => {
    console.warn('[TagWriter] Operation journal persistence failed.', String(error));
  });
};

const parsePersistedStatus = (candidate: unknown): SafWriteOperationStatus => {
  const value = candidate as Partial<SafWriteOperationStatus>;
  const validState = value.operationStatus === 'pending' || value.operationStatus === 'recovery-pending' ||
    value.operationStatus === 'completed' || value.operationStatus === 'failed';
  const terminalMatchesState = value.terminal === (value.operationStatus === 'completed' || value.operationStatus === 'failed');
  if (typeof value.operationId !== 'string' || typeof value.targetKey !== 'string' || !validState || !terminalMatchesState)
    throw new Error('Contradictory persisted tag-write operation journal.');
  return {
    operationId: value.operationId, targetKey: value.targetKey,
    phase: value.terminal ? (value.operationStatus === 'completed' ? 'completed' : 'failed') : 'pendingNativeResult',
    terminal: Boolean(value.terminal), retryable: Boolean(value.retryable),
    operationStatus: value.operationStatus as SafWriteOperationStatus['operationStatus'],
    updatedAt: value.updatedAt ?? Date.now(), errorCode: value.errorCode,
    commitConfirmed: value.commitConfirmed === true,
  };
};

/** Restores non-terminal ownership before writes are accepted after a restart. */
export const restoreSafWriteOperations = async (): Promise<SafWriteOperationStatus[]> => {
  const raw = await AsyncStorage.getItem(OPERATION_STORAGE_KEY);
  if (!raw) return [];
  let values: unknown;
  try { values = JSON.parse(raw); } catch { values = undefined; }
  if (!Array.isArray(values)) throw new Error('Invalid persisted tag-write operation journal.');
  const restored: SafWriteOperationStatus[] = [];
  for (const candidate of values) {
    const parsed = parsePersistedStatus(candidate);
    if (parsed.terminal) durableTerminalOperations.set(parsed.operationId, { ...parsed });
    const active = activeSafWrites.get(parsed.targetKey);
    const indexed = safWriteOperationsById.get(parsed.operationId);
    // A retry must reuse the installed owner. Otherwise reconciliation mutates
    // the lock while persistence serializes a separate, stale status object.
    const status = active?.operationId === parsed.operationId ? active : indexed ?? parsed;
    if (!active || active.operationId === parsed.operationId)
      safWriteOperationsById.set(status.operationId, status);
    if (!status.terminal && (!active || active.operationId === status.operationId)) {
      // Never replace an owner registered after the restoration boundary.
      if (!active) activeSafWrites.set(status.targetKey, status);
      restored.push({ ...status });
    }
  }
  return restored;
};

/** Applies native recovery results without allowing an old operation to replace a newer owner. */
export const reconcileSafWriteOperation = async (
  operationId: string,
  update: Pick<SafWriteOperationStatus, 'operationStatus' | 'terminal' | 'retryable'> & Partial<Pick<SafWriteOperationStatus, 'phase' | 'errorCode'>>,
): Promise<boolean> => {
  const entry = [...activeSafWrites.entries()].find(([, value]) => value.operationId === operationId);
  if (!entry) return false;
  const [key, current] = entry;
  safWriteOperationsById.set(operationId, current);
  const next = { ...current, ...update, updatedAt: Date.now() };
  // Terminal recovery is published only after the matching journal snapshot is
  // durable. A failed write therefore leaves the canonical owner retryable.
  if (next.terminal) {
    await persistOperations([next]);
    Object.assign(current, next);
    if (activeSafWrites.get(key)?.operationId === operationId) activeSafWrites.delete(key);
  } else {
    Object.assign(current, next);
    await persistOperations();
  }
  return true;
};

export const clearSafWriteOperationsForTests = (): void => {
  activeSafWrites.clear();
  safWriteOperationsById.clear();
  durableTerminalOperations.clear();
  resetSafWriteStartupForTests();
};

export const resetSafWriteStartupForTests = (ready = true): void => {
  startupState = ready ? 'ready' : 'pending';
  startupError = undefined;
  startupBarrier = ready ? Promise.resolve() : new Promise<void>(resolve => { resolveStartup = resolve; });
};

type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

const applySettledStatus = <T>(status: SafWriteOperationStatus, outcome: Settled<T>, options: SafWriteOperationOptions<T>): void => {
  status.phase = outcome.ok ? (options.phaseForResult?.(outcome.value) ?? 'completed') : 'failed';
  status.terminal = true;
  status.retryable = !outcome.ok;
  const recoveryPending = outcome.ok && options.recoveryPendingForResult?.(outcome.value) === true;
  status.operationStatus = recoveryPending ? 'recovery-pending' : status.phase === 'completed' ? 'completed' : 'failed';
  if (recoveryPending) status.terminal = false;
  status.updatedAt = Date.now();
};

const releaseTerminalOwner = (targetKey: string, operationId: string, status: SafWriteOperationStatus): void => {
  if (status.terminal && activeSafWrites.get(targetKey)?.operationId === operationId)
    activeSafWrites.delete(targetKey);
};

const persistConfirmedSuccess = async (
  status: SafWriteOperationStatus,
  completed: SafWriteOperationStatus,
  targetKey: string,
  operationId: string,
): Promise<void> => {
  try {
    await persistOperations([{ ...completed, commitConfirmed: undefined }]);
  } catch (error) {
    // Native has committed, but success is not durable yet. Keep the target
    // owned and nonterminal so no caller can start a duplicate mutation.
    status.phase = 'pendingNativeResult';
    status.terminal = false;
    status.retryable = true;
    status.operationStatus = 'recovery-pending';
    status.errorCode = 'TerminalJournalPersistenceFailed';
    status.commitConfirmed = true;
    status.updatedAt = Date.now();
    persistObserved(persistOperations());
    throw new Error(`Native tag write committed, but its terminal journal could not be persisted: ${String(error)}`);
  }
  Object.assign(status, completed, { commitConfirmed: undefined, errorCode: completed.errorCode });
  releaseTerminalOwner(targetKey, operationId, status);
};

/** Retries journal durability for a native commit without invoking native again. */
export const retryConfirmedSafWriteCommit = async (operationId: string): Promise<boolean> => {
  const status = safWriteOperationsById.get(operationId);
  if (!status?.commitConfirmed || status.terminal) return false;
  const completed: SafWriteOperationStatus = {
    ...status, phase: 'completed', terminal: true, retryable: false,
    operationStatus: 'completed', errorCode: undefined, commitConfirmed: undefined, updatedAt: Date.now(),
  };
  await persistOperations([completed]);
  Object.assign(status, completed);
  releaseTerminalOwner(status.targetKey, operationId, status);
  return true;
};

const completedStatus = <T>(
  status: SafWriteOperationStatus,
  outcome: Settled<T>,
  options: SafWriteOperationOptions<T>,
): SafWriteOperationStatus => {
  const completed = { ...status };
  applySettledStatus(completed, outcome, options);
  return completed;
};

const publishSettledOutcome = async <T>(
  status: SafWriteOperationStatus,
  outcome: Settled<T>,
  options: SafWriteOperationOptions<T>,
  targetKey: string,
  operationId: string,
): Promise<void> => {
  const completed = completedStatus(status, outcome, options);
  if (!outcome.ok) {
    Object.assign(status, completed);
    releaseTerminalOwner(targetKey, operationId, status);
    persistObserved(persistOperations());
    throw outcome.error;
  }
  if (completed.operationStatus === 'completed') {
    await persistConfirmedSuccess(status, completed, targetKey, operationId);
    return;
  }
  Object.assign(status, completed);
  releaseTerminalOwner(targetKey, operationId, status);
  persistObserved(persistOperations());
};

const observeLateSettlement = <T>(
  settled: Promise<Settled<T>>,
  status: SafWriteOperationStatus,
  options: SafWriteOperationOptions<T>,
  targetKey: string,
  operationId: string,
): void => {
  void settled.then(outcome => publishSettledOutcome(status, outcome, options, targetKey, operationId))
    .catch(error => {
      if (status.errorCode === 'TerminalJournalPersistenceFailed')
        console.warn('[TagWriter] Late terminal journal persistence failed.', String(error));
    });
};

export const runSafWriteOperation = async <T>(
  uri: string,
  startNativeMutation: (operationId: string) => Promise<T>,
  options: SafWriteOperationOptions<T> = {},
): Promise<{ kind: 'result'; value: T; status: SafWriteOperationStatus } | { kind: 'pending'; status: SafWriteOperationStatus } | { kind: 'busy'; status: SafWriteOperationStatus }> => {
  await awaitSafWriteStartup();
  const targetKey = canonicalSafTarget(uri);
  const operationId = options.operationId ?? createTagWriteOperationId();
  const existing = activeSafWrites.get(targetKey);
  if (existing) {
    if (existing.commitConfirmed) {
      // This is a persistence retry, never a second native mutation. The caller
      // remains a blocked attempt and therefore cannot emit a duplicate success.
      await retryConfirmedSafWriteCommit(existing.operationId);
    }
    const rejected: SafWriteOperationStatus = {
      operationId, targetKey, phase: 'failed', terminal: true, retryable: true,
      blockedByOperationId: existing.operationId,
      operationStatus: 'failed', updatedAt: Date.now(),
    };
    safWriteOperationsById.set(operationId, rejected);
    persistObserved(persistOperations());
    return {
      kind: 'busy',
      status: { ...rejected },
    };
  }

  const status: SafWriteOperationStatus = {
    operationId, targetKey,
    phase: 'accepted', terminal: false, retryable: false,
    operationStatus: 'pending', updatedAt: Date.now(),
  };
  activeSafWrites.set(targetKey, status);
  safWriteOperationsById.set(operationId, status);
  persistObserved(persistOperations());
  status.phase = 'lockAcquired';

  if (options.timeoutMs !== undefined && options.timeoutMs <= 0) {
    status.phase = 'cancelledBeforeMutation'; status.terminal = true; status.retryable = true; status.operationStatus = 'failed'; status.updatedAt = Date.now();
    activeSafWrites.delete(targetKey);
    persistObserved(persistOperations());
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
    await publishSettledOutcome(status, outcome, options, targetKey, operationId);
    if (!outcome.ok) throw outcome.error;
    return { kind: 'result', value: outcome.value, status: { ...status } };
  }

  const timeout = new Promise<{ timeout: true }>(resolve => { timer = setTimeout(() => resolve({ timeout: true }), options.timeoutMs); });
  const first = await Promise.race([settled, timeout]);
  if ('timeout' in first) {
    status.phase = 'pendingNativeResult'; status.retryable = false; status.operationStatus = 'pending'; status.updatedAt = Date.now();
    persistObserved(persistOperations());
    observeLateSettlement(settled, status, options, targetKey, operationId);
    return { kind: 'pending', status: { ...status } };
  }
  if (timer) clearTimeout(timer);
  await publishSettledOutcome(status, first, options, targetKey, operationId);
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
