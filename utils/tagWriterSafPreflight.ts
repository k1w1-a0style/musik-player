import SystemAudio, { type AudioTagWriteResult } from 'expo-system-audio';
import type { TagEditDraft, TagEditableContainer, WriteTagsResult } from '../types/TagEdit';
import { TagWriterError } from './tagWriterError';
import { validateTagWriteDraftOrThrow } from './tagWriterValidation';
import { buildNativeTagWriteRequest, changedFieldsForNativeTagDraft } from './tagWriterNativeRequest';
import { resolveSafeTagWriteMaxFileSizeBytes } from './tagWriterLimits';
export interface SafTagWriteOptions {
  maxFileSizeBytes?: number; timeoutMs?: number; operationId?: string;
  expectedOriginalSizeBytes?: number; expectedOriginalSha256Hex?: string;
  /** Runs after durable SAF reservation and before constructing/starting the native request. */
  preflight?: () => Promise<string | undefined>;
}
const validateExpectation = (options: SafTagWriteOptions): void => {
  const size = options.expectedOriginalSizeBytes;
  const hash = options.expectedOriginalSha256Hex;
  if (size === undefined && hash === undefined) return;
  if (!Number.isSafeInteger(size) || size! < 1 || !hash || !/^[a-fA-F0-9]{64}$/.test(hash))
    throw new TagWriterError('InvalidTagData', 'Source expectation requires a positive size and SHA-256.');
};
export const runSafTagWritePreflight = async (options: SafTagWriteOptions): Promise<void> => {
  validateExpectation(options);
  const reason = await options.preflight?.();
  if (reason) throw new TagWriterError('TransactionConflict', reason);
};
const errorStatus = (error: unknown): WriteTagsResult['status'] => {
  if (!(error instanceof TagWriterError)) return 'writeFailed';
  if (error.code === 'MissingWritePermission') return 'permissionDenied';
  if (error.code === 'UnsupportedUri' || error.code === 'UnsupportedFormat') return 'unsupportedUri';
  return 'writeFailed';
};
const failureResult = (error: unknown, uri: string): WriteTagsResult => ({
  status: errorStatus(error), sourceUri: uri, warnings: [],
  errorCode: error instanceof TagWriterError ? error.code : 'WriteNotImplemented',
  errorMessage: error instanceof Error ? error.message : String(error),
});
export const executeSafNativeWrite = async (
  uri: string, draft: TagEditDraft, container: TagEditableContainer, operationId: string,
  options: SafTagWriteOptions, toResult: (result: AudioTagWriteResult) => WriteTagsResult,
): Promise<WriteTagsResult> => {
  if (!SystemAudio.hasNativeTagWriter) return toResult({
    success: false, uri, changedFields: [], failedFields: changedFieldsForNativeTagDraft(draft),
    errorCode: 'WriteNotImplemented', message: 'Native streaming SAF audio tag writer is unavailable. A new Development Build/APK is required.',
    verified: false, operationId, phase: 'FAILED', terminal: true, retryable: false,
  });
  try {
    validateTagWriteDraftOrThrow(draft);
    const maxBytes = resolveSafeTagWriteMaxFileSizeBytes(options.maxFileSizeBytes);
    await runSafTagWritePreflight(options);
    const request = buildNativeTagWriteRequest(draft, container, maxBytes, operationId, {
      expectedOriginalSizeBytes: options.expectedOriginalSizeBytes,
      expectedOriginalSha256Hex: options.expectedOriginalSha256Hex,
    });
    return toResult(await SystemAudio.writeAudioTags(uri, request));
  } catch (error) { return failureResult(error, uri); }
};
