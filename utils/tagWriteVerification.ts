import SystemAudio from 'expo-system-audio';
import type { TagEditDraft, TagEditableContainer } from '../types/TagEdit';
import type { Song } from '../types/Song';
import { decodeBase64ToBytes } from './base64';
import { getUriType } from './tagEditCapability';
import { expoTagFileWriteAdapter, type TagFileWriteAdapter } from './tagFileWriteAdapter';
import { DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES } from './tagWriteOrchestrator';
import { applyTagEditToBuffer } from './tagWriterValidation';

export const hasTagDeletionIntent = (draft: TagEditDraft): boolean =>
  Boolean(draft.removeCover)
  || Object.keys(draft.tags).some(key => {
    const value = draft.tags[key as keyof TagEditDraft['tags']];
    return typeof value === 'string' && value.trim().length === 0;
  });

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean =>
  left.length === right.length && left.every((byte, index) => byte === right[index]);

type TagDeletionVerificationOptions = {
  adapter?: TagFileWriteAdapter;
  maxFileSizeBytes?: number;
  readContentBase64?: (uri: string, maxBytes: number) => Promise<string | null>;
};

const readWrittenBytes = async (
  uri: string,
  options: TagDeletionVerificationOptions,
): Promise<Uint8Array | undefined> => {
  const maxBytes = options.maxFileSizeBytes ?? DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES;
  const uriType = getUriType(uri);

  if (uriType === 'file') {
    const adapter = options.adapter ?? expoTagFileWriteAdapter;
    const info = await adapter.getInfo(uri);
    if (!info.exists || info.isDirectory || (typeof info.size === 'number' && info.size > maxBytes)) {
      return undefined;
    }
    const bytes = await adapter.readBytes(uri);
    return bytes.length <= maxBytes ? bytes : undefined;
  }

  if (uriType === 'content') {
    const readContentBase64 = options.readContentBase64
      ?? ((targetUri: string, limit: number) => SystemAudio.readAudioFileBase64(targetUri, limit));
    const base64 = await readContentBase64(uri, maxBytes);
    if (!base64) return undefined;
    const bytes = decodeBase64ToBytes(base64);
    return bytes.length <= maxBytes ? bytes : undefined;
  }

  return undefined;
};

/**
 * Proves that an explicit text/cover deletion is already represented in the
 * bytes currently stored at the writer target. Re-applying the same draft must
 * be byte-idempotent; an unreadable target or any additional mutation fails
 * verification instead of trusting a pre-cleared metadata seed.
 */
export const verifyTagDeletionState = async (
  song: Song,
  draft: TagEditDraft,
  container: TagEditableContainer,
  options: TagDeletionVerificationOptions = {},
): Promise<boolean> => {
  if (!hasTagDeletionIntent(draft) || container === 'unsupported') return false;
  const uri = song.fileInfo?.uri?.trim() || song.uri?.trim();
  if (!uri) return false;

  try {
    const writtenBytes = await readWrittenBytes(uri, options);
    if (!writtenBytes?.length) return false;
    const reapplied = applyTagEditToBuffer(writtenBytes, container, draft);
    return bytesEqual(writtenBytes, reapplied);
  } catch {
    return false;
  }
};
