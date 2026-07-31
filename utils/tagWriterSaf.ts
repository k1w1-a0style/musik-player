import SystemAudio, { type AudioTagWriteRequest, type AudioTagWriteResult } from 'expo-system-audio';
import type { Song } from '../types/Song';
import type { TagEditDraft, WriteTagsResult } from '../types/TagEdit';
import { runSafWriteOperation } from './tagWriterLocks';
import { getSupportedContainer } from './tagEditCapability';
import { normalizeTagWriterErrorCode, TagWriterError } from './tagWriterError';
import { validateTagWriteDraftOrThrow } from './tagWriterValidation';
import { buildNativeTagWriteRequest, changedFieldsForNativeTagDraft } from './tagWriterNativeRequest';
import { resolveSafeTagWriteMaxFileSizeBytes } from './tagWriterLimits';

const failureStatus = (code?: string): WriteTagsResult['status'] => {
  if (code === 'MissingWritePermission') return 'permissionDenied';
  if (code === 'UnsupportedFormat' || code === 'UnsupportedUri') return 'unsupportedUri';
  return 'writeFailed';
};

const toResult = (nativeResult: AudioTagWriteResult, warnings: string[] = []): WriteTagsResult => {
  const errorCode = nativeResult.success ? undefined : normalizeTagWriterErrorCode(nativeResult.errorCode, nativeResult.message ?? '');
  const status: WriteTagsResult['status'] = nativeResult.success && nativeResult.verified
    ? (nativeResult.noop ? 'noop' : 'written')
    : failureStatus(errorCode);
  return {
    status,
    sourceUri: nativeResult.uri,
    backupUri: nativeResult.backupUri,
    tempUri: nativeResult.tempUri,
    bytesBefore: nativeResult.bytesBefore,
    bytesAfter: nativeResult.bytesAfter,
    warnings,
    errorCode,
    errorMessage: nativeResult.success ? undefined : nativeResult.message,
    transactionId: nativeResult.transactionId,
    recoveryPending: nativeResult.recoveryPending,
    recovered: nativeResult.recovered,
    cleanupPending: nativeResult.cleanupPending,
    operationId: nativeResult.operationId ?? nativeResult.transactionId,
    operationPhase: nativeResult.phase === 'COMPLETED' ? 'completed' : nativeResult.phase === 'FAILED' ? 'failed' : undefined,
    terminal: nativeResult.terminal,
    retryable: nativeResult.retryable,
  };
};

export const writeTagsToSafContentUri = async (
  song: Song,
  draft: TagEditDraft,
  options?: { maxFileSizeBytes?: number; timeoutMs?: number; operationId?: string },
): Promise<WriteTagsResult> => {
  const uri = song.fileInfo?.uri ?? song.uri;
  if (!uri) {
    return { status: 'unsupportedUri', warnings: [], errorCode: 'UnsupportedUri', errorMessage: 'Song has no editable URI.' };
  }

  const execution = await runSafWriteOperation(uri, async (operationId): Promise<WriteTagsResult> => {
    const container = getSupportedContainer(song);
    const changedFields = changedFieldsForNativeTagDraft(draft);
    if (!SystemAudio.hasNativeTagWriter) {
      return toResult({
        success: false,
        uri,
        changedFields: [],
        failedFields: changedFields,
        errorCode: 'WriteNotImplemented',
        message: 'Native streaming SAF audio tag writer is unavailable. A new Development Build/APK is required.',
        verified: false,
      });
    }

    try {
      validateTagWriteDraftOrThrow(draft);
      const maxBytes = resolveSafeTagWriteMaxFileSizeBytes(options?.maxFileSizeBytes);
      const request: AudioTagWriteRequest = buildNativeTagWriteRequest(draft, container, maxBytes, operationId);
      return toResult(await SystemAudio.writeAudioTags(uri, request));
    } catch (error) {
      if (error instanceof TagWriterError) {
        return {
          status: failureStatus(error.code),
          sourceUri: uri,
          warnings: [],
          errorCode: error.code,
          errorMessage: error.message,
        };
      }
      return {
        status: 'writeFailed',
        sourceUri: uri,
        warnings: [],
        errorCode: 'WriteNotImplemented',
        errorMessage: String(error),
      };
    }
  }, options);

  if (execution.kind === 'result' && execution.status.phase === 'cancelledBeforeMutation') {
    return { status: 'cancelled', sourceUri: uri, warnings: [], operationId: execution.status.operationId, operationPhase: execution.status.phase, terminal: true, retryable: true };
  }
  if (execution.kind === 'pending' || execution.kind === 'busy') {
    return {
      status: 'writeFailed', sourceUri: uri, warnings: [],
      errorCode: execution.kind === 'busy' ? 'TransactionConflict' : 'RecoveryPending',
      errorMessage: execution.kind === 'busy' ? 'A tag write is already active for this SAF document.' : 'The native mutation is still running; its outcome is not known yet.',
      operationId: execution.status.operationId,
      operationPhase: execution.status.phase,
      terminal: false,
      retryable: execution.kind === 'busy',
      recoveryPending: true,
    };
  }
  return { ...execution.value, operationId: execution.status.operationId, operationPhase: execution.status.phase, terminal: true };
};
