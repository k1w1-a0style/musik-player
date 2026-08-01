import SystemAudio from 'expo-system-audio';
import type { SafWriteOperationStatus } from './tagWriterLocks';
import { reconcileSafWriteOperation, restoreSafWriteOperations } from './tagWriterLocks';

/**
 * Reclaims persisted JS ownership and compares it with the durable native
 * transaction journal. Unknown/missing native information remains locked and
 * recovery-pending rather than being guessed terminal.
 */
export const restoreAndReconcileTagWrites = async (): Promise<SafWriteOperationStatus[]> => {
  const restored = await restoreSafWriteOperations();
  if (restored.length === 0) return restored;
  if (!SystemAudio.hasNativeTagWriter) return restored;

  const recovery = await SystemAudio.recoverPendingAudioTagTransactions();
  const results = new Map((recovery.transactions ?? []).map(result => [result.transactionId, result]));
  for (const operation of restored) {
    const result = results.get(operation.operationId);
    if (!result || result.pending) {
      await reconcileSafWriteOperation(operation.operationId, {
        operationStatus: 'recovery-pending', phase: 'pendingNativeResult',
        terminal: false, retryable: true, errorCode: result?.errorCode ?? 'RecoveryPending',
      });
    } else if (result.recovered) {
      await reconcileSafWriteOperation(operation.operationId, {
        operationStatus: 'completed', phase: 'completed', terminal: true, retryable: false,
      });
    } else {
      await reconcileSafWriteOperation(operation.operationId, {
        operationStatus: 'failed', phase: 'failed', terminal: true,
        retryable: true, errorCode: result.errorCode ?? recovery.errorCode ?? 'RecoveryFailed',
      });
    }
  }
  return restored;
};
