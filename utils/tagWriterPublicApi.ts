import SystemAudio from 'expo-system-audio';
import type { Song } from '../types/Song';
import type { TagEditDraft, TagEditPlan, TagWriterErrorCode, WriteTagsResult } from '../types/TagEdit';
import { createTagWriteOperationPlan } from './tagWriteOrchestrator';
import type { TagFileWriteAdapter } from './tagFileWriteAdapter';
import { writeTagsToFileOrThrow } from './tagWriterFileReplace';
import { resolveWritableFileTagUri } from './tagWriterPayload';
import { getUriType } from './tagEditCapability';
import { writeTagsToSafContentUri } from './tagWriterSaf';
import { DEFAULT_SAF_TAG_WRITE_TIMEOUT_MS } from './tagWriterLimits';
import { TagWriterError, tagWriterWarn } from './tagWriterError';

const LOCAL_FILE_CRASH_RECOVERY_UNAVAILABLE =
  'Local file tag writing is blocked until a persistent crash-recovery journal is available.';

const isLocalFileWriteSafetyClaim = (warning: string): boolean =>
  warning.startsWith('MP3/M4A/MP4 file:// writes use ') ||
  warning.startsWith('file:// writes use backup + temp + byte verification');

const failClosedLocalFilePlan = (plan: TagEditPlan): TagEditPlan => {
  if (plan.uriType !== 'file') return plan;
  return {
    ...plan,
    permission: {
      ...plan.permission,
      canWrite: false,
      reason: LOCAL_FILE_CRASH_RECOVERY_UNAVAILABLE,
    },
    backup: { required: false, strategy: 'none' },
    atomicWrite: { required: false, supportsAtomicReplace: false },
    rollback: { required: false, supportsRollback: false, steps: [] },
    requiresBackup: false,
    requiresTempFile: false,
    supportsAtomicReplace: false,
    supportsRollback: false,
    safetyCapabilities: {
      durableBackup: false,
      inMemoryRollback: false,
      atomicReplace: false,
      postWriteVerification: false,
      crashRecovery: false,
    },
    warnings: [
      ...plan.warnings.filter(warning => !isLocalFileWriteSafetyClaim(warning)),
      LOCAL_FILE_CRASH_RECOVERY_UNAVAILABLE,
    ],
    blockingReasons: [...new Set([...plan.blockingReasons, 'WriteNotImplemented' as const])],
  };
};

export const prepareTagEditPlan = (song: Song, draft: TagEditDraft): TagEditPlan =>
  failClosedLocalFilePlan(createTagWriteOperationPlan(
    song,
    draft,
    undefined,
    undefined,
    { safDurableWriterAvailable: SystemAudio.hasNativeTagWriter },
  ));

const tagWriterFailureStatus = (code: TagWriterErrorCode): WriteTagsResult['status'] => {
  if (code === 'UnsupportedUri' || code === 'UnsupportedFormat') return 'unsupportedUri';
  if (code === 'MissingWritePermission') return 'permissionDenied';
  return 'writeFailed';
};

const toWriteTagsFailureResult = (
  error: unknown,
  sourceUri?: string,
): WriteTagsResult => {
  if (error instanceof TagWriterError) {
    tagWriterWarn(`Tag write failed with ${error.code}: ${error.message}`, error);
    return {
      status: tagWriterFailureStatus(error.code),
      sourceUri,
      warnings: [],
      errorCode: error.code,
      errorMessage: error.message,
    };
  }
  const errorMessage = String(error);
  tagWriterWarn(`Tag write failed: ${errorMessage}`, error);
  return {
    status: 'writeFailed',
    sourceUri,
    warnings: [],
    errorCode: 'WriteNotImplemented',
    errorMessage,
  };
};

export type WriteTagsOptions = {
  adapter?: TagFileWriteAdapter;
  maxFileSizeBytes?: number;
  timeoutMs?: number;
  operationId?: string;
};

export const writeTagsToFile = async (
  song: Song,
  draft: TagEditDraft,
  options: WriteTagsOptions = {},
): Promise<WriteTagsResult> => {
  const rawUri = song.fileInfo?.uri ?? song.uri;
  const uriType = getUriType(rawUri);
  if (uriType === 'content') {
    if (song.fileInfo?.source === 'media-library') {
      return toWriteTagsFailureResult(
        new TagWriterError(
          'MissingWritePermission',
          'MediaLibrary content:// tracks require an explicit SAF write grant before tag editing.',
        ),
        rawUri,
      );
    }
    return writeTagsToSafContentUri(song, draft, {
      maxFileSizeBytes: options.maxFileSizeBytes,
      timeoutMs: options.timeoutMs ?? DEFAULT_SAF_TAG_WRITE_TIMEOUT_MS,
      operationId: options.operationId,
    });
  }

  // The adapter-injected path remains available for deterministic unit testing
  // of the guarded backup/temp/rollback algorithm. Production calls use the
  // default adapter and must remain fail-closed until local writes have the same
  // persistent restart-recovery contract as the native SAF transaction writer.
  if (uriType === 'file' && !options.adapter) {
    return toWriteTagsFailureResult(
      new TagWriterError('WriteNotImplemented', LOCAL_FILE_CRASH_RECOVERY_UNAVAILABLE),
      rawUri,
    );
  }

  const writableUri = resolveWritableFileTagUri(song);
  if (!writableUri.ok) {
    const error = new TagWriterError(writableUri.reason, writableUri.message);
    return toWriteTagsFailureResult(error);
  }

  try {
    return await writeTagsToFileOrThrow(song, draft, options);
  } catch (error) {
    return toWriteTagsFailureResult(error, writableUri.uri);
  }
};
