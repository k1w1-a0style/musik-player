import {
  makeDirectoryAsync,
  writeAsStringAsync,
  EncodingType,
  documentDirectory,
  cacheDirectory,
  getInfoAsync,
  copyAsync,
} from 'expo-file-system/legacy';
import * as FileSystem from 'expo-file-system';
import type { Song } from '../types/Song';
import { waitForCoverCacheCleanupIdle, type CoverCacheProtection } from './coverCacheCleanup';
import {
  Base64DecodeError,
  decodeBase64PrefixToBytes,
  getBase64DecodedByteLength,
  getBase64DecodedByteLengthEstimate,
  validateBase64Payload,
} from './base64';
import { detectImageMimeFromBytes, imageExtensionFromMime, normalizeImageMime } from './imageMime';

const DATA_URI_RE = /^data:image\/([a-zA-Z0-9.+-]+);base64,/i;
export const MAX_CACHED_COVER_BYTES = 2 * 1024 * 1024;
export const COVER_SANITIZE_BATCH_SIZE = 20;

export const isBase64ImageDataUri = (value?: string): boolean => {
  if (!value) return false;
  return DATA_URI_RE.test(value.trim());
};

export type CoverCacheWriteFailureReason =
  | 'cache_directory_unavailable'
  | 'cache_filesystem_unavailable'
  | 'cache_mkdir_failed'
  | 'cache_info_failed'
  | 'cache_write_failed'
  | 'cache_unexpected_failed';

class CoverCacheWriteError extends Error {
  constructor(readonly reason: CoverCacheWriteFailureReason, readonly cause?: unknown) {
    super(reason);
    this.name = 'CoverCacheWriteError';
  }
}

const logCoverCacheWarning = (reason: CoverCacheWriteFailureReason): void => {
  console.warn('[CoverCache]', 'Optional cover cache write failed; embedded cover will not be persisted.', { reason });
};

const withCoverCacheFailureReason = async <T>(
  operation: Promise<T>,
  reason: CoverCacheWriteFailureReason,
): Promise<T> => {
  try {
    return await operation;
  } catch (error) {
    throw new CoverCacheWriteError(reason, error);
  }
};

const getCoverCacheFailureReason = (error: unknown): CoverCacheWriteFailureReason =>
  error instanceof CoverCacheWriteError ? error.reason : 'cache_unexpected_failed';

const hashString = (value: string): string => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  let h3 = 0xc0decafe;
  let h4 = 0x9e3779b9;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
    h3 = Math.imul(h3 ^ code, 2246822507);
    h4 = Math.imul(h4 ^ code, 3266489909);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h3 ^ (h3 >>> 13), 3266489909);
  h3 = Math.imul(h3 ^ (h3 >>> 16), 2246822507) ^ Math.imul(h4 ^ (h4 >>> 13), 3266489909);
  h4 = Math.imul(h4 ^ (h4 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return [h1, h2, h3, h4].map(part => (part >>> 0).toString(16).padStart(8, '0')).join('');
};

const getBaseDirectory = (): string | undefined =>
  documentDirectory
  ?? cacheDirectory
  ?? (FileSystem as { documentDirectory?: string | null }).documentDirectory
  ?? (FileSystem as { cacheDirectory?: string | null }).cacheDirectory
  ?? undefined;

const FILE_EXTENSION_RE = /\.([a-zA-Z0-9]+)(?:[?#].*)?$/;

const isRemoteUri = (uri: string): boolean => /^https?:\/\//i.test(uri.trim());

const deriveCoverFileExtension = (uri: string): string => {
  const match = uri.match(FILE_EXTENSION_RE);
  const ext = match?.[1]?.toLowerCase();
  if (ext && ext.length <= 5) return ext;
  return 'jpg';
};

export const getManagedCoverCacheDirectory = (): string | undefined => {
  const baseDir = getBaseDirectory();
  return baseDir ? `${baseDir}covers` : undefined;
};

export const isManagedCoverCacheUri = (uri?: string): boolean => {
  if (!uri) return false;
  const directory = getManagedCoverCacheDirectory();
  return Boolean(directory && uri.trim().startsWith(`${directory}/`));
};

export const isLikelyVolatileArtworkUri = (uri?: string): boolean => {
  if (!uri) return false;
  const trimmed = uri.trim();
  if (!trimmed || isRemoteUri(trimmed) || isManagedCoverCacheUri(trimmed)) return false;
  const volatileRoot = cacheDirectory
    ?? (FileSystem as { cacheDirectory?: string | null }).cacheDirectory
    ?? undefined;
  return Boolean(volatileRoot && trimmed.startsWith(volatileRoot));
};

export const cacheLocalCoverFile = async (
  songId: string,
  sourceUri?: string,
  protection?: CoverCacheProtection,
): Promise<string | undefined> => {
  const source = sourceUri?.trim();
  if (!source || isRemoteUri(source)) return undefined;
  const directory = getManagedCoverCacheDirectory();
  if (!directory) {
    logCoverCacheWarning('cache_directory_unavailable');
    return undefined;
  }

  try {
    const mkdir = makeDirectoryAsync
      ?? (FileSystem as unknown as { makeDirectoryAsync?: typeof makeDirectoryAsync }).makeDirectoryAsync;
    const copy = copyAsync
      ?? (FileSystem as unknown as { copyAsync?: typeof copyAsync }).copyAsync;
    const getInfo = getInfoAsync
      ?? (FileSystem as unknown as { getInfoAsync?: typeof getInfoAsync }).getInfoAsync;
    if (!mkdir || !copy || !getInfo) {
      logCoverCacheWarning('cache_filesystem_unavailable');
      return undefined;
    }

    const sourceInfo = await withCoverCacheFailureReason(getInfo(source), 'cache_info_failed');
    if (!sourceInfo.exists) return undefined;
    await withCoverCacheFailureReason(mkdir(directory, { intermediates: true }), 'cache_mkdir_failed');

    const safeSongId = hashString(songId);
    const sourceHash = hashString(source);
    const fileUri = `${directory}/${safeSongId}-${sourceHash}.${deriveCoverFileExtension(source)}`;
    protection?.protectUri(fileUri);
    await waitForCoverCacheCleanupIdle();
    const existing = await withCoverCacheFailureReason(getInfo(fileUri), 'cache_info_failed');
    if (existing.exists) return fileUri;
    await withCoverCacheFailureReason(copy({ from: source, to: fileUri }), 'cache_write_failed');
    return fileUri;
  } catch (error) {
    logCoverCacheWarning(getCoverCacheFailureReason(error));
    return undefined;
  }
};

export const cacheBase64Cover = async (
  songId: string,
  cover?: string,
  protection?: CoverCacheProtection,
): Promise<string | undefined> => {
  if (!cover) return undefined;
  const trimmed = cover.trim();
  const match = trimmed.match(DATA_URI_RE);
  if (!match) return cover;

  const rawBase64 = trimmed.slice(match[0].length);
  if (getBase64DecodedByteLengthEstimate(rawBase64) > MAX_CACHED_COVER_BYTES) return undefined;

  let base64: string;
  let prefixBytes: Uint8Array;
  try {
    base64 = validateBase64Payload(rawBase64);
    if (getBase64DecodedByteLength(base64) > MAX_CACHED_COVER_BYTES) return undefined;
    prefixBytes = decodeBase64PrefixToBytes(base64, 16);
  } catch (error) {
    if (error instanceof Base64DecodeError) return undefined;
    throw error;
  }
  const declaredMime = normalizeImageMime(match[1]);
  const detectedMime = detectImageMimeFromBytes(prefixBytes);
  if (declaredMime) {
    if (detectedMime !== declaredMime) return undefined;
  } else if (!detectedMime) {
    return undefined;
  }

  const baseDir = getBaseDirectory();
  if (!baseDir) {
    logCoverCacheWarning('cache_directory_unavailable');
    return undefined;
  }

  try {
    const directory = `${baseDir}covers`;
    const mkdir = makeDirectoryAsync
      ?? (FileSystem as unknown as { makeDirectoryAsync?: typeof makeDirectoryAsync }).makeDirectoryAsync;
    const write = writeAsStringAsync
      ?? (FileSystem as unknown as { writeAsStringAsync?: typeof writeAsStringAsync }).writeAsStringAsync;
    const getInfo = getInfoAsync
      ?? (FileSystem as unknown as { getInfoAsync?: typeof getInfoAsync }).getInfoAsync;
    if (!mkdir || !write || !getInfo) {
      logCoverCacheWarning('cache_filesystem_unavailable');
      return undefined;
    }

    await withCoverCacheFailureReason(mkdir(directory, { intermediates: true }), 'cache_mkdir_failed');

    const ext = imageExtensionFromMime(detectedMime ?? declaredMime ?? 'image/jpeg');
    const contentHash = hashString(base64);
    const safeSongId = hashString(songId);
    const fileUri = `${directory}/${safeSongId}-${contentHash}.${ext}`;
    protection?.protectUri(fileUri);
    await waitForCoverCacheCleanupIdle();
    const existing = await withCoverCacheFailureReason(getInfo(fileUri), 'cache_info_failed');
    if (existing.exists) return fileUri;
    const base64Encoding = (EncodingType.Base64 ?? 'base64') as 'base64';
    await withCoverCacheFailureReason(write(fileUri, base64, {
      encoding: base64Encoding,
    }), 'cache_write_failed');
    return fileUri;
  } catch (error) {
    logCoverCacheWarning(getCoverCacheFailureReason(error));
    return undefined;
  }
};

const removeEmbeddedCoverForStorage = (song: Song): Song => {
  const { cover: _cover, coverInfo: _coverInfo, ...rest } = song;
  return {
    ...rest,
    coverInfo: {
      status: 'none',
    },
  };
};

export const sanitizeSongCover = async (song: Song, protection?: CoverCacheProtection): Promise<Song> => {
  if (!song.cover || !isBase64ImageDataUri(song.cover)) {
    protection?.protectUri(song.cover);
    protection?.protectUri(song.coverInfo?.uri);
    return song;
  }
  const cachedUri = await cacheBase64Cover(song.id, song.cover, protection);
  if (!cachedUri) return removeEmbeddedCoverForStorage(song);
  return {
    ...song,
    cover: cachedUri,
    coverInfo: {
      ...song.coverInfo,
      status: 'cached',
      uri: cachedUri,
    },
  };
};

export const sanitizeSongsForStorage = async (
  songs: Song[],
  protection?: CoverCacheProtection,
): Promise<Song[]> => {
  const sanitized: Song[] = [];
  for (let i = 0; i < songs.length; i += COVER_SANITIZE_BATCH_SIZE) {
    const batch = songs.slice(i, i + COVER_SANITIZE_BATCH_SIZE);
    sanitized.push(...await Promise.all(batch.map(song => sanitizeSongCover(song, protection))));
  }
  return sanitized;
};
