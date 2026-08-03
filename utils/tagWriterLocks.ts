import AsyncStorage from '@react-native-async-storage/async-storage';

const writeLocksByUri = new Map<string, Promise<void>>();
const OPERATION_STORAGE_KEY = '@musik-player/tag-write-operations/v1';
const NATIVE_ONLY_OUTCOME_STORAGE_KEY = '@musik-player/tag-write-native-only-outcomes/v1';
const NATIVE_ONLY_OUTCOME_RECORD_PREFIX = `${NATIVE_ONLY_OUTCOME_STORAGE_KEY}/record/`;
const JOURNAL_LIMIT = 50;

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
  /** Native recovery is terminal, but the terminal journal record is not durable yet. */
  confirmedTerminalOutcome?: Pick<SafWriteOperationStatus,
    'operationStatus' | 'phase' | 'terminal' | 'retryable' | 'errorCode'> & {
      /** The native recovery pass which produced this outcome had no other unresolved journals. */
      nativeRecoverySummaryComplete?: boolean;
    };
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
const nativeOnlyOperationIds = new Set<string>();
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
    for (const status of durableTerminalOperations.values()) records.set(status.operationId, { ...status });
    // Overrides are the newest evidence and must win over cached history.
    for (const status of overrides) records.set(status.operationId, { ...status });
    const mandatoryIds = new Set(overrides.map(status => status.operationId));
    for (const status of activeSafWrites.values()) mandatoryIds.add(status.operationId);
    for (const status of records.values()) {
      if (status.commitConfirmed || status.confirmedTerminalOutcome) mandatoryIds.add(status.operationId);
    }
    if (mandatoryIds.size > JOURNAL_LIMIT)
      throw new Error(`Tag-write operation journal has ${mandatoryIds.size} mandatory records; limit is ${JOURNAL_LIMIT}.`);
    const mandatory = [...mandatoryIds]
      .map(id => records.get(id))
      .filter((status): status is SafWriteOperationStatus => Boolean(status));
    const optional = [...records.values()]
      .filter(status => !mandatoryIds.has(status.operationId))
      .sort((left, right) => right.updatedAt - left.updatedAt || left.operationId.localeCompare(right.operationId));
    const snapshot = [...mandatory, ...optional.slice(0, JOURNAL_LIMIT - mandatory.length)];
    if (overrides.some(status => !snapshot.some(item => item.operationId === status.operationId)))
      throw new Error('Tag-write journal snapshot omitted a required override.');
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

const CONFIRMED_OUTCOME_KEYS = new Set([
  'operationStatus', 'phase', 'terminal', 'retryable', 'errorCode', 'nativeRecoverySummaryComplete',
]);

const isCompletedEvidence = (value: Partial<SafWriteOperationStatus>): boolean =>
  value.operationStatus === 'completed' && value.phase === 'completed' && value.terminal === true &&
  value.retryable === false && value.errorCode === undefined;

const isFailedEvidence = (value: Partial<SafWriteOperationStatus>): boolean =>
  value.operationStatus === 'failed' && value.phase === 'failed' && value.terminal === true &&
  typeof value.retryable === 'boolean' && typeof value.errorCode === 'string' && value.errorCode.length > 0;

const validateConfirmedTerminalOutcome = (owner: Partial<SafWriteOperationStatus>): void => {
  const confirmed = owner.confirmedTerminalOutcome;
  if (confirmed === undefined) return;
  const validObject = Boolean(confirmed) && typeof confirmed === 'object' && !Array.isArray(confirmed);
  if (!validObject) throw new Error('Invalid confirmed terminal tag-write outcome.');
  const knownFields = Object.keys(confirmed).every(key => CONFIRMED_OUTCOME_KEYS.has(key));
  const validMarker = confirmed.nativeRecoverySummaryComplete === undefined ||
    typeof confirmed.nativeRecoverySummaryComplete === 'boolean';
  if (!knownFields || !validMarker) throw new Error('Invalid confirmed terminal tag-write outcome.');
  const validOutcome = isCompletedEvidence(confirmed) || isFailedEvidence(confirmed);
  const validOwner = owner.terminal === false && owner.operationStatus === 'recovery-pending' &&
    owner.commitConfirmed !== true && owner.errorCode === 'TerminalJournalPersistenceFailed';
  if (!validOutcome || !validOwner) throw new Error('Contradictory confirmed terminal tag-write outcome.');
};

const parsePersistedStatus = (candidate: unknown): SafWriteOperationStatus => {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate))
    throw new Error('Invalid persisted tag-write operation journal record.');
  const value = candidate as Partial<SafWriteOperationStatus>;
  const validStates = ['pending', 'recovery-pending', 'completed', 'failed'];
  const validState = validStates.includes(value.operationStatus ?? '');
  const terminalState = value.operationStatus === 'completed' || value.operationStatus === 'failed';
  const validIdentity = typeof value.operationId === 'string' && typeof value.targetKey === 'string';
  const validCommitMarker = value.commitConfirmed === undefined || typeof value.commitConfirmed === 'boolean';
  if (!validIdentity || !validState || value.terminal !== terminalState || !validCommitMarker)
    throw new Error('Contradictory persisted tag-write operation journal.');
  validateConfirmedTerminalOutcome(value);
  return {
    operationId: value.operationId as string, targetKey: value.targetKey as string,
    phase: value.terminal ? (value.operationStatus === 'completed' ? 'completed' : 'failed') : 'pendingNativeResult',
    terminal: Boolean(value.terminal), retryable: Boolean(value.retryable),
    operationStatus: value.operationStatus as SafWriteOperationStatus['operationStatus'],
    updatedAt: value.updatedAt ?? Date.now(), errorCode: value.errorCode,
    commitConfirmed: value.commitConfirmed === true,
    confirmedTerminalOutcome: value.confirmedTerminalOutcome,
  };
};

export type ConfirmedRecoveryUpdate = {
  operationId: string;
  outcome: NonNullable<SafWriteOperationStatus['confirmedTerminalOutcome']>;
};

export type NativeOnlyRecoveryEvidence = {
  kind: 'native-only-recovery-outcome';
  operationId: string;
  outcome: NonNullable<SafWriteOperationStatus['confirmedTerminalOutcome']>;
};

const parseNativeOnlyEvidence = (candidate: unknown): NativeOnlyRecoveryEvidence => {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate))
    throw new Error('Invalid native-only recovery evidence.');
  const value = candidate as Partial<NativeOnlyRecoveryEvidence>;
  const knownFields = Object.keys(value).every(key => ['kind', 'operationId', 'outcome'].includes(key));
  if (!knownFields || value.kind !== 'native-only-recovery-outcome' ||
    typeof value.operationId !== 'string' || value.operationId.length === 0 ||
    value.operationId.trim() !== value.operationId || /[\u0000-\u001f\u007f]/u.test(value.operationId))
    throw new Error('Invalid native-only recovery evidence.');
  const owner: Partial<SafWriteOperationStatus> = {
    terminal: false, operationStatus: 'recovery-pending', commitConfirmed: false,
    errorCode: 'TerminalJournalPersistenceFailed', confirmedTerminalOutcome: value.outcome,
  };
  validateConfirmedTerminalOutcome(owner);
  return { kind: value.kind, operationId: value.operationId, outcome: { ...value.outcome! } };
};

const nativeOnlyRecordKey = (operationId: string): string =>
  `${NATIVE_ONLY_OUTCOME_RECORD_PREFIX}${encodeURIComponent(operationId)}`;

const nativeOnlyStatus = (evidence: NativeOnlyRecoveryEvidence): SafWriteOperationStatus => ({
  operationId: evidence.operationId,
  // Native-only history has no JS owner. This non-URI identity is public
  // provenance only and is deliberately never entered in activeSafWrites.
  targetKey: `native-only:${encodeURIComponent(evidence.operationId)}`,
  phase: evidence.outcome.phase,
  terminal: true,
  retryable: evidence.outcome.retryable,
  operationStatus: evidence.outcome.operationStatus,
  updatedAt: 0,
  errorCode: evidence.outcome.errorCode,
});

const installNativeOnlyEvidence = (evidence: NativeOnlyRecoveryEvidence): void => {
  const existing = safWriteOperationsById.get(evidence.operationId);
  if (existing && JSON.stringify({
    operationStatus: existing.operationStatus, phase: existing.phase, terminal: existing.terminal,
    retryable: existing.retryable, errorCode: existing.errorCode,
  }) !== JSON.stringify(evidence.outcome))
    throw new Error('Contradictory native-only recovery evidence.');
  const status = existing ?? nativeOnlyStatus(evidence);
  nativeOnlyOperationIds.add(evidence.operationId);
  safWriteOperationsById.set(evidence.operationId, status);
  durableTerminalOperations.set(evidence.operationId, { ...status });
};

const assertNativeOnlyEvidenceMatchesPublicStatus = (evidence: NativeOnlyRecoveryEvidence): void => {
  const existing = safWriteOperationsById.get(evidence.operationId);
  if (!existing) return;
  if (!nativeOnlyOperationIds.has(evidence.operationId))
    throw new Error('Operation ID exists in both owned and native-only recovery evidence.');
  const publicOutcome = {
    operationStatus: existing.operationStatus, phase: existing.phase, terminal: existing.terminal,
    retryable: existing.retryable, errorCode: existing.errorCode,
  };
  if (JSON.stringify(publicOutcome) !== JSON.stringify(evidence.outcome))
    throw new Error('Contradictory native-only recovery evidence.');
};

/** Durably classifies a terminal receipt which has no persisted JavaScript owner. */
export const persistNativeOnlyRecoveryEvidence = async (
  operationId: string,
  outcome: NativeOnlyRecoveryEvidence['outcome'],
): Promise<void> => {
  const next = parseNativeOnlyEvidence({ kind: 'native-only-recovery-outcome', operationId, outcome });
  assertNativeOnlyEvidenceMatchesPublicStatus(next);
  const key = nativeOnlyRecordKey(operationId);
  const existingRaw = await AsyncStorage.getItem(key);
  let existing: NativeOnlyRecoveryEvidence | undefined;
  if (existingRaw) {
    let candidate: unknown;
    try { candidate = JSON.parse(existingRaw); } catch { candidate = undefined; }
    existing = parseNativeOnlyEvidence(candidate);
  }
  if (existing && JSON.stringify(existing) !== JSON.stringify(next))
    throw new Error('Contradictory native-only recovery evidence.');
  // Each outcome is an immutable durable public record. The bounded legacy
  // index is no longer an authority and therefore cannot evict evidence that
  // is about to be acknowledged, even for batches larger than JOURNAL_LIMIT.
  if (!existing) await AsyncStorage.setItem(key, JSON.stringify(next));
  installNativeOnlyEvidence(next);
};

const restoreNativeOnlyRecoveryEvidence = async (): Promise<void> => {
  const evidenceById = new Map<string, NativeOnlyRecoveryEvidence>();
  const raw = await AsyncStorage.getItem(NATIVE_ONLY_OUTCOME_STORAGE_KEY);
  if (raw) {
    let values: unknown;
    try { values = JSON.parse(raw); } catch { values = undefined; }
    if (!Array.isArray(values)) throw new Error('Invalid native-only recovery evidence journal.');
    for (const value of values) {
      const evidence = parseNativeOnlyEvidence(value);
      const previous = evidenceById.get(evidence.operationId);
      if (previous && JSON.stringify(previous) !== JSON.stringify(evidence))
        throw new Error('Contradictory native-only recovery evidence.');
      evidenceById.set(evidence.operationId, evidence);
    }
  }
  const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(NATIVE_ONLY_OUTCOME_RECORD_PREFIX));
  for (const key of keys) {
    const rawRecord = await AsyncStorage.getItem(key);
    if (rawRecord === null) throw new Error('Missing native-only recovery evidence record.');
    let candidate: unknown;
    try { candidate = JSON.parse(rawRecord); } catch { candidate = undefined; }
    const evidence = parseNativeOnlyEvidence(candidate);
    if (key !== nativeOnlyRecordKey(evidence.operationId))
      throw new Error('Mismatched native-only recovery evidence key.');
    const previous = evidenceById.get(evidence.operationId);
    if (previous && JSON.stringify(previous) !== JSON.stringify(evidence))
      throw new Error('Contradictory native-only recovery evidence.');
    evidenceById.set(evidence.operationId, evidence);
  }
  evidenceById.forEach(installNativeOnlyEvidence);
};

/** Stages every consumed native report before any individual terminal record is published. */
export const stageConfirmedSafWriteOutcomes = async (updates: ConfirmedRecoveryUpdate[]): Promise<string[]> => {
  const staged: SafWriteOperationStatus[] = [];
  for (const { operationId, outcome } of updates) {
    const current = safWriteOperationsById.get(operationId);
    if (!current || current.terminal) continue;
    current.phase = 'pendingNativeResult';
    current.terminal = false;
    current.retryable = true;
    current.operationStatus = 'recovery-pending';
    current.errorCode = 'TerminalJournalPersistenceFailed';
    current.confirmedTerminalOutcome = { ...outcome };
    current.updatedAt = Date.now();
    staged.push(current);
  }
  // One snapshot contains all evidence from the native summary. If this fails,
  // every staged in-memory owner remains intact and native tombstones remain unacked.
  if (staged.length > 0) await persistOperations();
  return staged.map(status => status.operationId);
};

/** Restores non-terminal ownership before writes are accepted after a restart. */
export const restoreSafWriteOperations = async (): Promise<SafWriteOperationStatus[]> => {
  await restoreNativeOnlyRecoveryEvidence();
  const raw = await AsyncStorage.getItem(OPERATION_STORAGE_KEY);
  if (!raw) return [];
  let values: unknown;
  try { values = JSON.parse(raw); } catch { values = undefined; }
  if (!Array.isArray(values)) throw new Error('Invalid persisted tag-write operation journal.');
  const restored: SafWriteOperationStatus[] = [];
  for (const candidate of values) {
    const parsed = parsePersistedStatus(candidate);
    if (nativeOnlyOperationIds.has(parsed.operationId))
      throw new Error('Operation ID exists in both owned and native-only recovery evidence.');
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
  update: Pick<SafWriteOperationStatus, 'operationStatus' | 'terminal' | 'retryable'> &
    Partial<Pick<SafWriteOperationStatus, 'phase' | 'errorCode'>> & { nativeRecoverySummaryComplete?: boolean },
): Promise<boolean> => {
  const entry = [...activeSafWrites.entries()].find(([, value]) => value.operationId === operationId);
  if (!entry) return false;
  const [key, current] = entry;
  safWriteOperationsById.set(operationId, current);
  const next = { ...current, ...update, updatedAt: Date.now() };
  // Terminal recovery is published only after the matching journal snapshot is
  // durable. A failed write therefore leaves the canonical owner retryable.
  if (next.terminal) {
    current.retryable = true;
    current.operationStatus = 'recovery-pending';
    current.errorCode = 'TerminalJournalPersistenceFailed';
    current.confirmedTerminalOutcome = {
      operationStatus: next.operationStatus, phase: next.phase,
      terminal: true, retryable: next.retryable, errorCode: next.errorCode,
      nativeRecoverySummaryComplete: update.nativeRecoverySummaryComplete,
    };
    current.updatedAt = Date.now();
    // Preserve a consumed native outcome before attempting canonical terminal
    // persistence, so restart retries never need the one-shot native report.
    await persistOperations();
    await persistOperations([{ ...next, confirmedTerminalOutcome: undefined }]);
    Object.assign(current, next);
    current.confirmedTerminalOutcome = undefined;
    if (activeSafWrites.get(key)?.operationId === operationId) activeSafWrites.delete(key);
  } else {
    Object.assign(current, next);
    await persistOperations();
  }
  return true;
};

/** Retries a confirmed recovery outcome without invoking native recovery again. */
export const retryConfirmedSafWriteOutcome = async (operationId: string): Promise<boolean> => {
  const status = safWriteOperationsById.get(operationId);
  const outcome = status?.confirmedTerminalOutcome;
  if (!status || !outcome || status.terminal) return false;
  const terminal = { ...status, ...outcome, confirmedTerminalOutcome: undefined, updatedAt: Date.now() };
  await persistOperations([terminal]);
  Object.assign(status, terminal);
  releaseTerminalOwner(status.targetKey, operationId, status);
  return true;
};

export const clearSafWriteOperationsForTests = (): void => {
  activeSafWrites.clear();
  safWriteOperationsById.clear();
  durableTerminalOperations.clear();
  nativeOnlyOperationIds.clear();
  persistenceQueue = Promise.resolve();
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

const resolveOperationIdentity = (requestedId: string | undefined, targetKey: string): {
  operationId: string;
  reused?: SafWriteOperationStatus;
} => {
  let operationId = requestedId ?? createTagWriteOperationId();
  while (requestedId === undefined && (safWriteOperationsById.has(operationId) || nativeOnlyOperationIds.has(operationId)))
    operationId = createTagWriteOperationId();
  if (requestedId === undefined ||
    (!safWriteOperationsById.has(operationId) && !nativeOnlyOperationIds.has(operationId))) return { operationId };
  return { operationId, reused: {
    operationId, targetKey, phase: 'failed', terminal: true, retryable: false,
    blockedByOperationId: operationId, operationStatus: 'failed',
    errorCode: 'OperationIdAlreadyUsed', updatedAt: Date.now(),
  } };
};

const hasMandatoryJournalCapacity = (operationId: string): boolean => {
  const mandatoryIds = new Set([...activeSafWrites.values()].map(item => item.operationId));
  for (const item of safWriteOperationsById.values()) {
    if (item.commitConfirmed || item.confirmedTerminalOutcome) mandatoryIds.add(item.operationId);
  }
  return mandatoryIds.has(operationId) || mandatoryIds.size < JOURNAL_LIMIT;
};

const journalCapacityRejection = (operationId: string, targetKey: string): SafWriteOperationStatus => ({
  operationId, targetKey, phase: 'failed', terminal: true, retryable: true,
  operationStatus: 'failed', errorCode: 'OperationJournalCapacityExceeded', updatedAt: Date.now(),
});

export const runSafWriteOperation = async <T>(
  uri: string,
  startNativeMutation: (operationId: string) => Promise<T>,
  options: SafWriteOperationOptions<T> = {},
): Promise<{ kind: 'result'; value: T; status: SafWriteOperationStatus } | { kind: 'pending'; status: SafWriteOperationStatus } | { kind: 'busy'; status: SafWriteOperationStatus }> => {
  await awaitSafWriteStartup();
  const targetKey = canonicalSafTarget(uri);
  const identity = resolveOperationIdentity(options.operationId, targetKey);
  const operationId = identity.operationId;
  if (identity.reused) return { kind: 'busy', status: identity.reused };
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

  // Reserve mandatory journal capacity synchronously, before registering an
  // owner or yielding to native code. JavaScript execution cannot interleave
  // before the Map writes, so back-to-back callers cannot both claim the final slot.
  if (!hasMandatoryJournalCapacity(operationId))
    return { kind: 'busy', status: journalCapacityRejection(operationId, targetKey) };

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
