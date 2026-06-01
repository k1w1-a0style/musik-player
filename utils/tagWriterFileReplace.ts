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
    const backupUri = buildAttemptScopedUri(uri, 'bak');
    const tempUri = buildAttemptScopedUri(uri, 'tmp');
    const cleanupBackupAndTemp = async (): Promise<void> => {
      try {
        await adapter.deleteFile(tempUri);
      } catch (error) {
        tagWriterWarn('Temp cleanup failed after aborted write; temp file retained.', error);
      }
      try {
        await adapter.deleteFile(backupUri);
      } catch (error) {
        tagWriterWarn('Backup cleanup failed after aborted write; backup file retained.', error);
      }
    };
    try {
      await adapter.copyFile(uri, backupUri);
    } catch {
      throw new TagWriterError('BackupFailed', 'Backup creation failed.');
    }
    try {
      await adapter.writeBytes(tempUri, next);
    } catch {
      await cleanupBackupAndTemp();
      throw new TagWriterError('TempWriteFailed', 'Temp file write failed.');
    }
    let tempBytes: Uint8Array;
    try {
      tempBytes = await adapter.readBytes(tempUri);
    } catch (error) {
      await cleanupBackupAndTemp();
      throw new TagWriterError(
        'VerificationFailed',
        `Temp output could not be verified: ${String(error)}`,
      );
    }
    if (!areBytesEqual(tempBytes, next)) {
      await cleanupBackupAndTemp();
      throw new TagWriterError(
        'VerificationFailed',
        'Temp output bytes do not match rewritten payload.',
      );
    }
    try {
      await adapter.moveOrReplaceFile(tempUri, uri);
    } catch (error) {
      try {
        await adapter.copyFile(backupUri, uri);
        const rollbackWarnings = [
          `Replace failed and rollback restored backup: ${String(error)}`,
        ];
        try {
          await adapter.deleteFile(tempUri);
        } catch {
          rollbackWarnings.push(
            'Temp cleanup failed after rollback; temp file retained.',
          );
        }
        try {
          await adapter.deleteFile(backupUri);
        } catch {
          rollbackWarnings.push(
            'Backup cleanup failed after rollback; backup file retained.',
          );
        }
        return {
          status: 'rolledBack',
          sourceUri: uri,
          backupUri,
          tempUri,
          bytesBefore: original.length,
          bytesAfter: original.length,
          warnings: rollbackWarnings,
        };
      } catch {
        throw new TagWriterError(
          'RollbackFailed',
          `Replace failed and rollback failed: ${String(error)}`,
        );
      }
    }
    const warnings: string[] = [];
    try {
      await adapter.deleteFile(tempUri);
    } catch {
      warnings.push('Temp cleanup failed; temp file retained.');
    }
    try {
      await adapter.deleteFile(backupUri);
    } catch {
      warnings.push('Backup cleanup failed; backup file retained.');
    }
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
