import {
  makeDirectoryAsync,
  writeAsStringAsync,
  EncodingType,
  documentDirectory,
  cacheDirectory,
} from 'expo-file-system/legacy';
import * as FileSystem from 'expo-file-system';
import type { Song } from '../types/Song';

const DATA_URI_RE = /^data:image\/([a-zA-Z0-9.+-]+);base64,/i;

export const isBase64ImageDataUri = (value?: string): boolean => {
  if (!value) return false;
  return DATA_URI_RE.test(value.trim());
};

const extensionFromMimeSubtype = (subtype: string): string => {
  const normalized = subtype.toLowerCase();
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  return 'jpg';
};

const detectSubtypeFromBytes = (bytes: Uint8Array): 'jpeg' | 'png' | 'webp' | undefined => {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (
    bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return 'png';
  if (
    bytes.length >= 12
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'webp';
  return undefined;
};

const isLikelyValidBase64Payload = (value: string): boolean => /^[A-Za-z0-9+/=\s]+$/.test(value) && value.replace(/\s+/g, '').length >= 4;

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

const matchesMimeSignature = (bytes: Uint8Array, subtype: string): boolean => {
  const normalized = subtype.toLowerCase();
  if (normalized.includes('jpeg') || normalized.includes('jpg')) {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (normalized.includes('png')) {
    return bytes.length >= 8
      && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
      && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  }
  if (normalized.includes('webp')) {
    return bytes.length >= 12
      && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  }
  return false;
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
    const prefixBytes = base64PrefixToBytes(base64);
    const declaredSubtype = match[1] ?? 'jpeg';
    const detectedSubtype = detectSubtypeFromBytes(prefixBytes);
    const knownDeclared = /(jpeg|jpg|png|webp)/i.test(declaredSubtype);
    if (knownDeclared) {
      if (!matchesMimeSignature(prefixBytes, declaredSubtype)) return undefined;
    } else if (!detectedSubtype) {
      return undefined;
    }
    const ext = extensionFromMimeSubtype(detectedSubtype ?? declaredSubtype);
    const contentHash = hashString(base64);
    const safeSongId = hashString(songId);
    const fileUri = `${directory}/${safeSongId}-${contentHash}.${ext}`;
    const getInfoAsync = (FileSystem as unknown as { getInfoAsync?: (uri: string) => Promise<{ exists: boolean }> }).getInfoAsync;
    if (getInfoAsync) {
      const existing = await getInfoAsync(fileUri);
      if (existing.exists) return fileUri;
    }
    const base64Encoding = (EncodingType.Base64 ?? 'base64') as 'base64';
    await write(fileUri, base64, {
      encoding: base64Encoding,
    });
    return fileUri;
  } catch {
    return undefined;
  }
};

export const sanitizeSongCover = async (song: Song): Promise<Song> => {
  if (!song.cover || !isBase64ImageDataUri(song.cover)) return song;
  const cachedUri = await cacheBase64Cover(song.id, song.cover);
  if (!cachedUri) return song;
  return { ...song, cover: cachedUri };
};

export const sanitizeSongsForStorage = async (songs: Song[]): Promise<Song[]> => {
  const sanitized = await Promise.all(songs.map(sanitizeSongCover));
  return sanitized;
};
