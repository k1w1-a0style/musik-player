import type { Song } from '../types/Song';
import type { TagEditDraft, WriteTagsResult } from '../types/TagEdit';
import { DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES } from './tagWriteOrchestrator';
import { expoTagFileWriteAdapter, type TagFileWriteAdapter } from './tagFileWriteAdapter';
import { areBytesEqual } from './tagWriterBytes';
import { withUriWriteLock } from './tagWriterLocks';
import { buildTagWritePayload } from './tagWriterPayload';
import { TagWriterError, tagWriterWarn } from './tagWriterError';
import { applyTagEditToBuffer, ensureTagEditWriteAllowed, validateTagWriteDraftOrThrow } from './tagWriterValidation';

type WriteTagsOptions = { adapter?: TagFileWriteAdapter; maxFileSizeBytes?: number };

type TagFileInfo = { exists: boolean; size?: number; isDirectory?: boolean };

type AttemptUris = { backupUri: string; tempUri: string };

const assertSafeFileSize = (size: number, maxFileSizeBytes: number): void => {
  if (size > maxFileSizeBytes) {
    throw new TagWriterError(
      'FileTooLarge',
      `Tag writing is disabled for files larger than ${Math.round(maxFileSizeBytes / (1024 * 1024))} MB.`,
    );
  }
};

const buildAttemptScopedUri = (uri: string, suffix: 'bak' | 'tmp'): string => {
  const entropy = Math.random().toString(36).slice(2, 10);
  const attemptId = `${Date.now()}-${entropy}`;
  return `${uri}.${attemptId}.${suffix}`;
};

const canAdapterReplaceExistingFile = async (adapter: TagFileWriteAdapter): Promise<boolean> =>
  typeof adapter.canReplaceExistingFile === 'function'
    ? adapter.canReplaceExistingFile()
    : adapter.canReplaceExistingFile !== false;

const readTargetInfo = async (
  adapter: TagFileWriteAdapter,
  uri: string,
): Promise<TagFileInfo> => {
  try {
    return await adapter.getInfo(uri);
  } catch (error) {
    throw new TagWriterError(
      'UnsupportedUri',
      `Target file info could not be read: ${String(error)}`,
    );
  }
};

const readTargetBytes = async (
  adapter: TagFileWriteAdapter,
  uri: string,
): Promise<Uint8Array> => {
  try {
    return await adapter.readBytes(uri);
  } catch (error) {
    throw new TagWriterError(
      'UnsupportedUri',
      `Target file could not be read: ${String(error)}`,
    );
  }
};

const cleanupAttemptFiles = async (
  adapter: TagFileWriteAdapter,
  { backupUri, tempUri }: AttemptUris,
  warnings?: string[],
  context = 'after aborted write',
): Promise<void> => {
  try {
    await adapter.deleteFile(tempUri);
  } catch (error) {
    const message = `Temp cleanup failed ${context}; temp file retained.`;
    if (warnings) warnings.push(message);
    else tagWriterWarn(message, error);
  }
  try {
    await adapter.deleteFile(backupUri);
  } catch (error) {
    const message = `Backup cleanup failed ${context}; backup file retained.`;
    if (warnings) warnings.push(message);
    else tagWriterWarn(message, error);
  }
};

const rollbackFromBackup = async (
  adapter: TagFileWriteAdapter,
  uri: string,
  original: Uint8Array,
  attemptUris: AttemptUris,
  reason: unknown,
): Promise<WriteTagsResult> => {
  const { backupUri, tempUri } = attemptUris;
  try {
    await adapter.copyFile(backupUri, uri);
    const restored = await adapter.readBytes(uri);
    if (!areBytesEqual(restored, original)) {
      throw new Error('Rollback verification failed; restored bytes differ from original.');
    }
    const rollbackWarnings = [
      `Replace failed and rollback restored backup: ${String(reason)}`,
    ];
    await cleanupAttemptFiles(adapter, attemptUris, rollbackWarnings, 'after rollback');
    return {
      status: 'rolledBack',
      sourceUri: uri,
      backupUri,
      tempUri,
      bytesBefore: original.length,
      bytesAfter: original.length,
      warnings: rollbackWarnings,
    };
  } catch (rollbackError) {
    try {
      await adapter.deleteFile(tempUri);
    } catch (cleanupError) {
      tagWriterWarn('Temp cleanup failed after failed rollback; temp file retained.', cleanupError);
    }
    throw new TagWriterError(
      'RollbackFailed',
      `Replace failed and rollback failed: ${String(reason)}; rollback error: ${String(rollbackError)}`,
    );
  }
};

const verifyBytes = async (
  adapter: TagFileWriteAdapter,
  uri: string,
  expected: Uint8Array,
  failurePrefix: string,
): Promise<void> => {
  let actual: Uint8Array;
  try {
    actual = await adapter.readBytes(uri);
  } catch (error) {
    throw new TagWriterError(
      'VerificationFailed',
      `${failurePrefix} could not be verified: ${String(error)}`,
    );
  }
  if (!areBytesEqual(actual, expected)) {
    throw new TagWriterError(
      'VerificationFailed',
      `${failurePrefix} bytes do not match rewritten payload.`,
    );
  }
};

export const writeTagsToFileOrThrow = async (
  song: Song,
  draft: TagEditDraft,
  options?: WriteTagsOptions,
): Promise<WriteTagsResult> => {
  const payload = buildTagWritePayload(song, draft);
  const uri = payload.uri;
  return withUriWriteLock(uri, async () => {
    const container = payload.container;
    const adapter = options?.adapter ?? expoTagFileWriteAdapter;
    const canReplace = await canAdapterReplaceExistingFile(adapter);
    ensureTagEditWriteAllowed(song, canReplace ? 'android' : 'web');
    if (!canReplace) {
      throw new TagWriterError(
        'WriteNotImplemented',
        'Safe existing file replacement is not supported on this platform yet.',
      );
    }
    validateTagWriteDraftOrThrow(draft);
    const maxFileSizeBytes =
      options?.maxFileSizeBytes ?? DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES;
    const info = await readTargetInfo(adapter, uri);
    if (!info.exists)
      throw new TagWriterError('UnsupportedUri', 'Target file is not readable.');
    if (info.isDirectory)
      throw new TagWriterError('UnsupportedUri', 'Target URI points to a directory.');
    if (typeof info.size === 'number') assertSafeFileSize(info.size, maxFileSizeBytes);

    const original = await readTargetBytes(adapter, uri);
    assertSafeFileSize(original.length, maxFileSizeBytes);
    const next = applyTagEditToBuffer(original, container, draft);
    if (areBytesEqual(original, next))
      return {
        status: 'noop',
        sourceUri: uri,
        bytesBefore: original.length,
        bytesAfter: next.length,
        warnings: [],
      };

    const attemptUris = {
      backupUri: buildAttemptScopedUri(uri, 'bak'),
      tempUri: buildAttemptScopedUri(uri, 'tmp'),
    };
    const { backupUri, tempUri } = attemptUris;

    try {
      await adapter.copyFile(uri, backupUri);
    } catch (error) {
      throw new TagWriterError('BackupFailed', `Backup creation failed: ${String(error)}`);
    }
    try {
      await adapter.writeBytes(tempUri, next);
    } catch (error) {
      await cleanupAttemptFiles(adapter, attemptUris);
      throw new TagWriterError('TempWriteFailed', `Temp file write failed: ${String(error)}`);
    }

    try {
      await verifyBytes(adapter, tempUri, next, 'Temp output');
    } catch (error) {
      await cleanupAttemptFiles(adapter, attemptUris);
      throw error;
    }

    try {
      await adapter.moveOrReplaceFile(tempUri, uri);
      await verifyBytes(adapter, uri, next, 'Replaced target');
    } catch (error) {
      return rollbackFromBackup(adapter, uri, original, attemptUris, error);
    }

    const warnings: string[] = [];
    await cleanupAttemptFiles(adapter, attemptUris, warnings, 'after successful write');
    return {
      status: 'written',
      sourceUri: uri,
      backupUri,
      tempUri,
      bytesBefore: original.length,
      bytesAfter: next.length,
      warnings,
    };
  });
};
