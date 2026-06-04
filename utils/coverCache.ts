import {
  makeDirectoryAsync,
  writeAsStringAsync,
  EncodingType,
  documentDirectory,
  cacheDirectory,
  getInfoAsync,
} from 'expo-file-system/legacy';
import * as FileSystem from 'expo-file-system';
import type { Song } from '../types/Song';
import { detectImageMimeFromBytes, imageExtensionFromMime, normalizeImageMime } from './imageMime';

const DATA_URI_RE = /^data:image\/([a-zA-Z0-9.+-]+);base64,/i;
export const MAX_CACHED_COVER_BYTES = 2 * 1024 * 1024;
export const COVER_SANITIZE_BATCH_SIZE = 20;

export const isBase64ImageDataUri = (value?: string): boolean => {
  if (!value) return false;
  return DATA_URI_RE.test(value.trim());
};

const isLikelyValidBase64Payload = (value: string): boolean => /^[A-Za-z0-9+/=\s]+$/.test(value) && value.replace(/\s+/g, '').length >= 4;

const getDecodedBase64ByteLength = (value: string): number => {
  const clean = value.replace(/\s+/g, '');
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - padding;
};

const base64PrefixToBytes = (value: string, maxBytes = 16): Uint8Array => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Int16Array(256).fill(-1);
  for (let i = 0; i < chars.length; i += 1) lookup[chars.charCodeAt(i)] = i;
  const clean = value.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(maxBytes);
  let buf = 0;
  let bits = 0;
  let j = 0;
  for (let i = 0; i < clean.length && j < maxBytes; i += 1) {
    const v = lookup[clean.charCodeAt(i)];
    if (v < 0) continue;
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[j] = (buf >> bits) & 0xff;
      j += 1;
    }
  }
  return out.subarray(0, j);
};

const hashString = (value: string): string => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
};

const getBaseDirectory = (): string | undefined =>
  documentDirectory
  ?? cacheDirectory
  ?? (FileSystem as { documentDirectory?: string | null }).documentDirectory
  ?? (FileSystem as { cacheDirectory?: string | null }).cacheDirectory
  ?? undefined;

export const cacheBase64Cover = async (songId: string, cover?: string): Promise<string | undefined> => {
  if (!cover) return undefined;
  const trimmed = cover.trim();
  const match = trimmed.match(DATA_URI_RE);
  if (!match) return cover;

  const baseDir = getBaseDirectory();
  if (!baseDir) return undefined;

  try {
    const directory = `${baseDir}covers`;
    const mkdir = makeDirectoryAsync
      ?? (FileSystem as unknown as { makeDirectoryAsync?: typeof makeDirectoryAsync }).makeDirectoryAsync;
    const write = writeAsStringAsync
      ?? (FileSystem as unknown as { writeAsStringAsync?: typeof writeAsStringAsync }).writeAsStringAsync;
    if (!mkdir || !write) return undefined;

    await mkdir(directory, { intermediates: true });

    const base64 = trimmed.slice(match[0].length);
    if (!isLikelyValidBase64Payload(base64)) return undefined;
    if (getDecodedBase64ByteLength(base64) > MAX_CACHED_COVER_BYTES) return undefined;
    const prefixBytes = base64PrefixToBytes(base64);
    const declaredMime = normalizeImageMime(match[1]);
    const detectedMime = detectImageMimeFromBytes(prefixBytes);
    if (declaredMime) {
      if (detectedMime !== declaredMime) return undefined;
    } else if (!detectedMime) {
      return undefined;
    }
    const ext = imageExtensionFromMime(detectedMime ?? declaredMime ?? 'image/jpeg');
    const contentHash = hashString(base64);
    const safeSongId = hashString(songId);
    const fileUri = `${directory}/${safeSongId}-${contentHash}.${ext}`;
    const existing = await getInfoAsync(fileUri);
    if (existing.exists) return fileUri;
    const base64Encoding = (EncodingType.Base64 ?? 'base64') as 'base64';
    await write(fileUri, base64, {
      encoding: base64Encoding,
    });
    return fileUri;
  } catch {
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

export const sanitizeSongCover = async (song: Song): Promise<Song> => {
  if (!song.cover || !isBase64ImageDataUri(song.cover)) return song;
  const cachedUri = await cacheBase64Cover(song.id, song.cover);
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

export const sanitizeSongsForStorage = async (songs: Song[]): Promise<Song[]> => {
  const sanitized: Song[] = [];
  for (let i = 0; i < songs.length; i += COVER_SANITIZE_BATCH_SIZE) {
    const batch = songs.slice(i, i + COVER_SANITIZE_BATCH_SIZE);
    sanitized.push(...await Promise.all(batch.map(sanitizeSongCover)));
  }
  return sanitized;
};
