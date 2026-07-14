import SystemAudio from 'expo-system-audio';
import type {
  TagEditDraft,
  TagEditableContainer,
  WriteTagsResult,
} from '../types/TagEdit';
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

export const shouldVerifyTagDeletionResult = (
  status: WriteTagsResult['status'],
  draft: TagEditDraft,
): boolean =>
  (status === 'written' || status === 'noop') && hasTagDeletionIntent(draft);

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean =>
  left.length === right.length && left.every((byte, index) => byte === right[index]);

const hasAsciiMarker = (
  bytes: Uint8Array,
  offset: number,
  marker: string,
): boolean => {
  if (offset < 0 || offset + marker.length > bytes.length) return false;
  for (let index = 0; index < marker.length; index += 1) {
    if (bytes[offset + index] !== marker.charCodeAt(index)) return false;
  }
  return true;
};

/**
 * The MP3 writer currently rewrites ID3v2 only. Known trailing metadata blocks
 * must therefore prevent deletion verification: otherwise a removed value can
 * remain in ID3v1/APE/Lyrics3 while re-applying the ID3v2 draft is byte-idempotent.
 */
export const hasUnsupportedMp3TailMetadata = (bytes: Uint8Array): boolean => {
  const candidateEnds = new Set<number>([bytes.length]);
  const id3v1Start = bytes.length - 128;
  if (hasAsciiMarker(bytes, id3v1Start, 'TAG')) {
    candidateEnds.add(id3v1Start);
    const enhancedId3v1Start = id3v1Start - 227;
    if (hasAsciiMarker(bytes, enhancedId3v1Start, 'TAG+')) {
      candidateEnds.add(enhancedId3v1Start);
    }
  }

  for (const end of candidateEnds) {
    if (hasAsciiMarker(bytes, end - 32, 'APETAGEX')) return true;
    if (hasAsciiMarker(bytes, end - 9, 'LYRICS200')) return true;
    if (hasAsciiMarker(bytes, end - 9, 'LYRICSEND')) return true;
  }

  return candidateEnds.size > 1;
};

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
 * be byte-idempotent; an unreadable target, unsupported MP3 tail metadata, or
 * any additional mutation fails verification instead of trusting a pre-cleared
 * metadata seed.
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
    if (container === 'mp3' && hasUnsupportedMp3TailMetadata(writtenBytes)) return false;
    const reapplied = applyTagEditToBuffer(writtenBytes, container, draft);
    return bytesEqual(writtenBytes, reapplied);
  } catch {
    return false;
  }
};