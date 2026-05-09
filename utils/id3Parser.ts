/**
 * Native-safe ID3v2 Parser.
 *
 * Reads binary data from a local file URI via expo-file-system's File API
 * and decodes ID3v2.3/v2.4 frames (TIT2, TPE1, TALB, TYER, TCON, APIC).
 *
 * No native module required — works in managed Expo workflow.
 */

import * as FileSystem from 'expo-file-system';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';

export interface Id3Tags {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  genre?: string;
  /** data:image/... base64 data URI */
  cover?: string;
}

type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

const decodeSyncsafe = (bytes: Uint8Array, off: number): number => {
  return (
    (bytes[off] << 21) |
    (bytes[off + 1] << 14) |
    (bytes[off + 2] << 7) |
    bytes[off + 3]
  );
};

const decodeSize = (bytes: Uint8Array, off: number): number => {
  return (
    (bytes[off] << 24) |
    (bytes[off + 1] << 16) |
    (bytes[off + 2] << 8) |
    bytes[off + 3]
  );
};

const readLatin1 = (bytes: Uint8Array, start: number, end: number): string => {
  let s = '';
  for (let i = start; i < end; i += 1) {
    const b = bytes[i];
    if (b === 0) break;
    s += String.fromCharCode(b);
  }
  return s;
};

const readUtf8 = (bytes: Uint8Array, start: number, end: number): string => {
  let out = '';
  let i = start;
  while (i < end) {
    const b = bytes[i];
    if (b === 0) break;
    if (b < 0x80) {
      out += String.fromCharCode(b);
      i += 1;
    } else if (b < 0xe0) {
      out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
      i += 2;
    } else if (b < 0xf0) {
      out += String.fromCharCode(
        ((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f),
      );
      i += 3;
    } else {
      i += 4;
    }
  }
  return out;
};

const readUtf16 = (bytes: Uint8Array, start: number, end: number): string => {
  // BOM
  let le = false;
  let i = start;
  if (bytes[i] === 0xff && bytes[i + 1] === 0xfe) {
    le = true;
    i += 2;
  } else if (bytes[i] === 0xfe && bytes[i + 1] === 0xff) {
    le = false;
    i += 2;
  }
  let out = '';
  while (i + 1 < end) {
    const hi = le ? bytes[i + 1] : bytes[i];
    const lo = le ? bytes[i] : bytes[i + 1];
    const code = (hi << 8) | lo;
    if (code === 0) break;
    out += String.fromCharCode(code);
    i += 2;
  }
  return out;
};

const decodeText = (bytes: Uint8Array, start: number, end: number): string => {
  if (start >= end) return '';
  const enc = bytes[start];
  const body = start + 1;
  switch (enc) {
    case 0x00:
      return readLatin1(bytes, body, end).trim();
    case 0x01:
    case 0x02:
      return readUtf16(bytes, body, end).trim();
    case 0x03:
      return readUtf8(bytes, body, end).trim();
    default:
      return readLatin1(bytes, start, end).trim();
  }
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const b = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out +=
      chars[(b >> 18) & 63] + chars[(b >> 12) & 63] + chars[(b >> 6) & 63] + chars[b & 63];
  }
  if (i < bytes.length) {
    const r = bytes.length - i;
    const b = (bytes[i] << 16) | ((r > 1 ? bytes[i + 1] : 0) << 8);
    out +=
      chars[(b >> 18) & 63] +
      chars[(b >> 12) & 63] +
      (r > 1 ? chars[(b >> 6) & 63] : '=') +
      '=';
  }
  return out;
};

const detectMimeFromMagicBytes = (bytes: Uint8Array): ImageMime | undefined => {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) return 'image/png';
  if (
    bytes.length >= 12
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'image/webp';
  return undefined;
};

const normalizeMime = (value?: string): ImageMime | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'image/jpeg';
  if (normalized.includes('png')) return 'image/png';
  if (normalized.includes('webp')) return 'image/webp';
  return undefined;
};

const buildCoverDataUri = (imageBytes: Uint8Array, mimeHint?: string): string | undefined => {
  if (imageBytes.length === 0) return undefined;
  const mime = normalizeMime(mimeHint) ?? detectMimeFromMagicBytes(imageBytes);
  if (!mime) return undefined;
  return `data:${mime};base64,${bytesToBase64(imageBytes)}`;
};

const decodeAPIC = (bytes: Uint8Array, start: number, end: number): string | undefined => {
  const enc = bytes[start];
  let p = start + 1;
  // MIME type (null-terminated latin1)
  let mimeEnd = p;
  while (mimeEnd < end && bytes[mimeEnd] !== 0) mimeEnd += 1;
  const mime = readLatin1(bytes, p, mimeEnd);
  p = mimeEnd + 1;
  // picture type byte
  p += 1;
  // description (encoded string, null-terminated)
  if (enc === 0x01 || enc === 0x02) {
    while (p + 1 < end && !(bytes[p] === 0 && bytes[p + 1] === 0)) p += 2;
    p += 2;
  } else {
    while (p < end && bytes[p] !== 0) p += 1;
    p += 1;
  }
  if (p >= end) return undefined;
  const imageBytes = bytes.subarray(p, end);
  return buildCoverDataUri(imageBytes, mime);
};

const decodePIC = (bytes: Uint8Array, start: number, end: number): string | undefined => {
  if (start + 6 >= end) return undefined;
  const enc = bytes[start];
  const format = readLatin1(bytes, start + 1, start + 4);
  let p = start + 5; // + picture type
  if (enc === 0x01 || enc === 0x02) {
    while (p + 1 < end && !(bytes[p] === 0 && bytes[p + 1] === 0)) p += 2;
    p += 2;
  } else {
    while (p < end && bytes[p] !== 0) p += 1;
    p += 1;
  }
  if (p >= end) return undefined;
  return buildCoverDataUri(bytes.subarray(p, end), format ? `image/${format}` : undefined);
};

/**
 * Parse ID3 tags from a raw Uint8Array (first ~1MB of the file is usually enough).
 * Supports ID3v2.3 and ID3v2.4 headers (ID3v2.2 omitted for simplicity).
 */
export const parseId3Buffer = (bytes: Uint8Array): Id3Tags => {
  const tags: Id3Tags = {};
  if (
    bytes.length < 10 ||
    bytes[0] !== 0x49 || // I
    bytes[1] !== 0x44 || // D
    bytes[2] !== 0x33 //    3
  ) {
    return tags;
  }
  const majorVersion = bytes[3];
  const totalSize = decodeSyncsafe(bytes, 6);
  const end = Math.min(bytes.length, 10 + totalSize);

  let p = 10;
  if (majorVersion === 2) {
    while (p + 6 <= end) {
      const id = readLatin1(bytes, p, p + 3);
      if (!id || id.charCodeAt(0) === 0) break;
      const frameSize = (bytes[p + 3] << 16) | (bytes[p + 4] << 8) | bytes[p + 5];
      if (frameSize <= 0 || p + 6 + frameSize > end) break;
      if (id === 'PIC' && !tags.cover) {
        const cover = decodePIC(bytes, p + 6, p + 6 + frameSize);
        if (cover) tags.cover = cover;
      }
      p += 6 + frameSize;
    }
    return tags;
  }
  while (p + 10 < end) {
    const id = readLatin1(bytes, p, p + 4);
    if (!id || id.charCodeAt(0) === 0) break;

    const frameSize =
      majorVersion === 4 ? decodeSyncsafe(bytes, p + 4) : decodeSize(bytes, p + 4);
    if (frameSize <= 0 || p + 10 + frameSize > end) break;

    const bodyStart = p + 10;
    const bodyEnd = bodyStart + frameSize;

    switch (id) {
      case 'TIT2':
        tags.title = decodeText(bytes, bodyStart, bodyEnd);
        break;
      case 'TPE1':
      case 'TPE2':
        if (!tags.artist) tags.artist = decodeText(bytes, bodyStart, bodyEnd);
        break;
      case 'TALB':
        tags.album = decodeText(bytes, bodyStart, bodyEnd);
        break;
      case 'TYER':
      case 'TDRC':
        tags.year = decodeText(bytes, bodyStart, bodyEnd);
        break;
      case 'TCON':
        tags.genre = decodeText(bytes, bodyStart, bodyEnd);
        break;
      case 'APIC':
        if (!tags.cover) {
          const cover = decodeAPIC(bytes, bodyStart, bodyEnd);
          if (cover) tags.cover = cover;
        }
        break;
      default:
        break;
    }
    p += 10 + frameSize;
  }
  return tags;
};

const base64ToBytes = (b64: string): Uint8Array => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Int16Array(256).fill(-1);
  for (let i = 0; i < chars.length; i += 1) lookup[chars.charCodeAt(i)] = i;
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buf = 0;
  let bits = 0;
  let j = 0;
  for (let i = 0; i < clean.length; i += 1) {
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

/**
 * Read & parse ID3 tags from a file URI (e.g. from expo-media-library or expo-document-picker).
 * Reads the first 1MB which is sufficient for almost all ID3v2 headers including embedded art.
 */
export const parseId3FromUri = async (uri: string): Promise<Id3Tags> => {
  try {
    const encodingBase64 = (EncodingType.Base64 ?? 'base64') as 'base64';
    try {
      const b64 = await readAsStringAsync(uri, {
        encoding: encodingBase64,
        length: 1024 * 1024,
      });
      return parseId3Buffer(base64ToBytes(b64));
    } catch {
      // fallback to File API when legacy path is unavailable
    }
    // New File API
    const FileCtor = (FileSystem as unknown as { File?: new (u: string) => { bytes: () => Promise<Uint8Array> } }).File;
    if (FileCtor) {
      const file = new FileCtor(uri);
      const bytes = await file.bytes();
      return parseId3Buffer(bytes.subarray(0, 1024 * 1024));
    }
    return {};
  } catch {
    return {};
  }
};
