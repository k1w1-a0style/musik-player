import SystemAudio from 'expo-system-audio';
import type { SafWriteOperationStatus } from './tagWriterLocks';
import {
  beginSafWriteStartupRestoration, finishSafWriteStartupRestoration,
  reconcileSafWriteOperation, restoreSafWriteOperations,
} from './tagWriterLocks';

type RecoveryTransaction = NonNullable<Awaited<ReturnType<typeof SystemAudio.recoverPendingAudioTagTransactions>>['transactions']>[number];

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
  const committed = result.resultState === 'COMMITTED' || (
    result.resultState == null && (
      result.previousState === 'COMMITTED' || result.previousState === 'WRITE_STARTED' ||
      result.previousState === 'WRITTEN_UNVERIFIED'
    )
  );
  if (committed) return {
    operationStatus: 'completed' as const, phase: 'completed' as const,
    terminal: true, retryable: false,
  };
  return {
    operationStatus: 'failed' as const, phase: 'failed' as const,
    terminal: true, retryable: true, errorCode: summaryError ?? 'RecoveryOutcomeInconsistent',
  };
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
    if (restored.length > 0 && !SystemAudio.hasNativeTagWriter) {
      for (const operation of restored) {
        await reconcileSafWriteOperation(operation.operationId, {
          operationStatus: 'failed', phase: 'failed', terminal: true, retryable: true,
          errorCode: 'WriteNotImplemented',
        });
      }
    } else if (SystemAudio.hasNativeTagWriter) {
      const recovery = await SystemAudio.recoverPendingAudioTagTransactions();
      const results = new Map((recovery.transactions ?? []).map(result => [result.transactionId, result]));
      for (const operation of restored) {
        const result = results.get(operation.operationId);
        // This call is the sole startup recovery authority. A missing report therefore
        // proves there is no live/recoverable native journal; fail the edit (never guess
        // success) and release its stale JS owner.
        await reconcileSafWriteOperation(operation.operationId, result ? mapNativeRecoveryOutcome(result, recovery.errorCode) : {
          operationStatus: 'failed', phase: 'failed', terminal: true, retryable: true,
          errorCode: 'RecoveryOutcomeUnavailable',
        });
      }
    }
    finishSafWriteStartupRestoration();
    return restored;
  } catch (error) {
    finishSafWriteStartupRestoration(error);
    throw error;
  }
};
