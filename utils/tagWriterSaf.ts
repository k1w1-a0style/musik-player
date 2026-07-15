import SystemAudio, { type AudioTagWriteRequest, type AudioTagWriteResult } from 'expo-system-audio';
import type { Song } from '../types/Song';
import type { TagEditDraft, WriteTagsResult } from '../types/TagEdit';
import { DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES } from './tagWriteOrchestrator';
import { decodeBase64ToBytes, encodeBytesToBase64 } from './base64';
import { withUriWriteLock } from './tagWriterLocks';
import { getSupportedContainer } from './tagEditCapability';
import { normalizeTagWriterErrorCode, TagWriterError } from './tagWriterError';
import { applyTagEditToBuffer, validateTagWriteDraftOrThrow } from './tagWriterValidation';
import { sha256Hex } from './sha256';

const textTagFields = ['title', 'artist', 'albumArtist', 'album', 'year', 'genre', 'trackNumber', 'discNumber', 'comment'] as const;

const changedFieldsForDraft = (draft: TagEditDraft): string[] => {
  const fields: string[] = textTagFields.filter(field => Object.prototype.hasOwnProperty.call(draft.tags, field));
  if (draft.cover || draft.removeCover) fields.push('cover');
  return fields;
};

const failureStatus = (code?: string): WriteTagsResult['status'] => {
  if (code === 'MissingWritePermission') return 'permissionDenied';
  if (code === 'UnsupportedFormat' || code === 'UnsupportedUri') return 'unsupportedUri';
  return 'writeFailed';
};

const toResult = (nativeResult: AudioTagWriteResult, warnings: string[] = []): WriteTagsResult => {
  const errorCode = nativeResult.success ? undefined : normalizeTagWriterErrorCode(nativeResult.errorCode, nativeResult.message ?? '');
  return {
  status: nativeResult.success && nativeResult.verified ? 'written' : failureStatus(errorCode),
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
};
};

export const writeTagsToSafContentUri = async (
  song: Song,
  draft: TagEditDraft,
  options?: { maxFileSizeBytes?: number },
): Promise<WriteTagsResult> => {
  const uri = song.fileInfo?.uri ?? song.uri;
  if (!uri) {
    return { status: 'unsupportedUri', warnings: [], errorCode: 'UnsupportedUri', errorMessage: 'Song has no editable URI.' };
  }

  return withUriWriteLock(uri, async () => {
    const container = getSupportedContainer(song);
    const changedFields = changedFieldsForDraft(draft);
    if (!SystemAudio.hasNativeTagWriter) {
      return toResult({
        success: false,
        uri,
        changedFields: [],
        failedFields: changedFields,
        errorCode: 'WriteNotImplemented',
        message: 'Native SAF audio tag writer is unavailable. A new Development Build/APK is required.',
        verified: false,
      });
    }

    try {
      validateTagWriteDraftOrThrow(draft);
      const maxBytes = options?.maxFileSizeBytes ?? DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES;
      const originalBase64 = await SystemAudio.readAudioFileBase64(uri, maxBytes);
      if (!originalBase64) throw new TagWriterError('UnsupportedUri', 'SAF/content:// file could not be read through the native module.');
      const original = decodeBase64ToBytes(originalBase64);
      if (original.length > maxBytes) throw new TagWriterError('FileTooLarge', 'File exceeds the safe tag write limit.');
      const rewritten = applyTagEditToBuffer(original, container, draft);
      if (rewritten.length === 0) throw new TagWriterError('InvalidTagData', 'Rewritten audio payload is empty.');
      if (rewritten.length > maxBytes) throw new TagWriterError('FileTooLarge', 'Rewritten file exceeds the safe tag write limit.');
      if (rewritten.length === original.length && rewritten.every((byte, index) => byte === original[index])) {
        return { status: 'noop', sourceUri: uri, bytesBefore: original.length, bytesAfter: rewritten.length, warnings: [] };
      }
      const request: AudioTagWriteRequest = {
        tags: { ...draft.tags },
        container,
        rewrittenAudioBase64: encodeBytesToBase64(rewritten),
        expectedOriginalSizeBytes: original.length,
        expectedOriginalSha256Hex: sha256Hex(original),
        expectedWrittenSizeBytes: rewritten.length,
        expectedWrittenSha256Hex: sha256Hex(rewritten),
        maxFileSizeBytes: maxBytes,
        changedFields,
        failedFields: [],
      };
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
  });
};