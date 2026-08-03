import SystemAudio from 'expo-system-audio';
import type { SafWriteOperationStatus } from './tagWriterLocks';
import {
  beginSafWriteStartupRestoration, finishSafWriteStartupRestoration,
  reconcileSafWriteOperation, restoreSafWriteOperations, retryConfirmedSafWriteCommit,
  retryConfirmedSafWriteOutcome, stageConfirmedSafWriteOutcomes, persistNativeOnlyRecoveryEvidence,
} from './tagWriterLocks';

type RecoveryTransaction = NonNullable<Awaited<ReturnType<typeof SystemAudio.recoverPendingAudioTagTransactions>>['transactions']>[number];
type RecoverySummary = Awaited<ReturnType<typeof SystemAudio.recoverPendingAudioTagTransactions>>;

const acknowledgeNativeOutcomes = async (operationIds: string[]): Promise<void> => {
  if (typeof SystemAudio.acknowledgeAudioTagRecoveryOutcomes === 'function')
    await SystemAudio.acknowledgeAudioTagRecoveryOutcomes(operationIds);
};

const assertRecoverySummarySettled = (recovery: RecoverySummary, retainedTerminalFailureCount: number): void => {
  // A failed summary can still be settled: native terminal failures are the
  // authoritative outcomes for their operations. Once every such receipt has
  // been made durable in JS (where an owner exists) and acknowledged, it must
  // not keep the global startup barrier closed forever.
  const incomplete = (recovery.pendingCount ?? 0) > 0 ||
    (recovery.transactions ?? []).some(result => result.pending) ||
    (recovery.failedCount ?? 0) > retainedTerminalFailureCount ||
    (recovery.success !== true && (recovery.failedCount ?? 0) === 0);
  if (!incomplete) return;
  throw new Error(recovery.errorCode ??
    `Native tag-write recovery incomplete (pending: ${recovery.pendingCount ?? 0}, failed: ${recovery.failedCount ?? 0}).`);
};

const isRecoverySummaryComplete = (recovery: RecoverySummary): boolean =>
  recovery.success === true && !recovery.errorCode &&
  (recovery.pendingCount ?? 0) === 0 && (recovery.failedCount ?? 0) === 0;

export const mapNativeRecoveryOutcome = (result: RecoveryTransaction, summaryError?: string) => {
  if (result.pending) return {
    operationStatus: 'recovery-pending' as const, phase: 'pendingNativeResult' as const,
    terminal: false, retryable: true, errorCode: result.errorCode ?? 'RecoveryPending',
  };
  if (result.recovered) return {
    operationStatus: 'failed' as const, phase: 'failed' as const,
    terminal: true, retryable: true, errorCode: result.errorCode ?? 'TagWriteRolledBack',
  };
  if (result.errorCode) return {
    operationStatus: 'failed' as const, phase: 'failed' as const,
    terminal: true, retryable: true, errorCode: result.errorCode,
  };
  const validCommitPredecessor = result.previousState === 'COMMITTED' ||
    result.previousState === 'WRITE_STARTED' || result.previousState === 'WRITTEN_UNVERIFIED' ||
    result.previousState === 'RECOVERY_REQUIRED' || result.previousState === 'RECOVERY_FAILED';
  const committed = validCommitPredecessor &&
    (result.resultState === 'COMMITTED' || result.resultState == null);
  if (committed) return {
    operationStatus: 'completed' as const, phase: 'completed' as const,
    terminal: true, retryable: false,
  };
  return {
    operationStatus: 'failed' as const, phase: 'failed' as const,
    terminal: true, retryable: true, errorCode: summaryError ?? 'RecoveryOutcomeInconsistent',
  };
};

const reconcileWithoutNativeWriter = async (unresolved: SafWriteOperationStatus[]): Promise<void> => {
  for (const operation of unresolved) {
    await reconcileSafWriteOperation(operation.operationId, {
      operationStatus: 'failed', phase: 'failed', terminal: true, retryable: true,
      errorCode: 'WriteNotImplemented',
    });
  }
};

const runNativeRecovery = async (unresolved: SafWriteOperationStatus[]): Promise<void> => {
  const recovery = await SystemAudio.recoverPendingAudioTagTransactions();
  const recoveryComplete = isRecoverySummaryComplete(recovery);
  const results = new Map((recovery.transactions ?? []).map(result => [result.transactionId, result]));
  const terminal = [];
  for (const operation of unresolved) {
    const result = results.get(operation.operationId);
    const outcome = result ? {
      ...mapNativeRecoveryOutcome(result, recovery.errorCode),
      nativeRecoverySummaryComplete: recoveryComplete,
    } : {
      operationStatus: 'failed', phase: 'failed', terminal: true, retryable: true,
      errorCode: 'RecoveryOutcomeUnavailable', nativeRecoverySummaryComplete: recoveryComplete,
    } as const;
    if (outcome.terminal) terminal.push({ operationId: operation.operationId, outcome });
    else await reconcileSafWriteOperation(operation.operationId, outcome);
  }
  // Install and persist the complete batch of terminal evidence before any
  // owner is terminally published or acknowledged to native.
  const staged = await stageConfirmedSafWriteOutcomes(terminal);
  for (const operationId of staged) {
    await retryConfirmedSafWriteOutcome(operationId);
  }
  // A native-only receipt is the sole replayable evidence when the process
  // died before its JS owner was written. Classify each such receipt durably
  // before acknowledging it. Persisting one record at a time makes a partial
  // batch failure explicit: only the proven durable prefix is acknowledged.
  const ownerIds = new Set(unresolved.map(operation => operation.operationId));
  const acknowledged = [...staged];
  try {
    for (const result of results.values()) {
      if (result.pending || ownerIds.has(result.transactionId)) continue;
      await persistNativeOnlyRecoveryEvidence(
        result.transactionId,
        mapNativeRecoveryOutcome(result, recovery.errorCode),
      );
      acknowledged.push(result.transactionId);
    }
  } catch (error) {
    if (acknowledged.length > 0) await acknowledgeNativeOutcomes(acknowledged);
    throw error;
  }
  if (acknowledged.length > 0) await acknowledgeNativeOutcomes(acknowledged);
  const terminalFailureCount = [...results.values()].filter(result => !result.pending && Boolean(result.errorCode)).length;
  assertRecoverySummarySettled(recovery, terminalFailureCount);
};

/**
 * Reclaims persisted JS ownership before invoking the sole native startup
 * recovery authority. Missing outcomes fail the edit rather than guessing
 * success, and release ownership because no recoverable native journal exists.
 */
export const restoreAndReconcileTagWrites = async (): Promise<SafWriteOperationStatus[]> => {
  beginSafWriteStartupRestoration();
  try {
    const restored = await restoreSafWriteOperations();
    for (const operation of restored) {
      if (operation.commitConfirmed) await retryConfirmedSafWriteCommit(operation.operationId);
      else if (operation.confirmedTerminalOutcome) {
        await retryConfirmedSafWriteOutcome(operation.operationId);
        await acknowledgeNativeOutcomes([operation.operationId]);
      }
    }
    const unresolved = restored.filter(operation => !operation.commitConfirmed && !operation.confirmedTerminalOutcome);
    const priorRecoveryWasComplete = restored.length > 0 && restored.every(operation =>
      operation.confirmedTerminalOutcome?.nativeRecoverySummaryComplete === true,
    );
    if (unresolved.length > 0 && !SystemAudio.hasNativeTagWriter) {
      await reconcileWithoutNativeWriter(unresolved);
    } else if (SystemAudio.hasNativeTagWriter && !priorRecoveryWasComplete) {
      await runNativeRecovery(unresolved);
    }
    finishSafWriteStartupRestoration();
    return restored;
  } catch (error) {
    finishSafWriteStartupRestoration(error);
    throw error;
  }
};
