/**
 * Native-safe ID3v2 Parser.
 *
 * Reads binary data from a local file URI via expo-file-system's File API
 * and decodes common ID3v2.2/v2.3/v2.4 text and cover frames.
 *
 * No native module required — works in managed Expo workflow.
 */

import * as FileSystem from 'expo-file-system';
import { readAsStringAsync, EncodingType, getInfoAsync } from 'expo-file-system/legacy';
import { detectImageMimeFromBytes, normalizeImageMime } from './imageMime';

export interface Id3Tags {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  genre?: string;
  trackNumber?: string;
  discNumber?: string;
  comment?: string;
  /** data:image/... base64 data URI */
  cover?: string;
}
const HEAD_READ_LIMIT = 1024 * 1024;
const TAIL_READ_LIMIT = 1024 * 1024;

const decodeSyncsafe = (bytes: Uint8Array, off: number): number => {
  return (
    (bytes[off] << 21) | (bytes[off + 1] << 14) | (bytes[off + 2] << 7) | bytes[off + 3]
  );
};

const decodeSize = (bytes: Uint8Array, off: number): number => {
  return (
    (bytes[off] << 24) | (bytes[off + 1] << 16) | (bytes[off + 2] << 8) | bytes[off + 3]
  );
};

const readU32 = (bytes: Uint8Array, off: number): number =>
  ((bytes[off] << 24) >>> 0) +
  (bytes[off + 1] << 16) +
  (bytes[off + 2] << 8) +
  bytes[off + 3];

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
    } else if ((b & 0xe0) === 0xc0) {
      if (i + 1 >= end) break;
      const b1 = bytes[i + 1];
      if ((b1 & 0xc0) !== 0x80) {
        out += '\ufffd';
        i += 1;
        continue;
      }
      out += String.fromCharCode(((b & 0x1f) << 6) | (b1 & 0x3f));
      i += 2;
    } else if ((b & 0xf0) === 0xe0) {
      if (i + 2 >= end) break;
      const b1 = bytes[i + 1];
      const b2 = bytes[i + 2];
      if ((b1 & 0xc0) !== 0x80 || (b2 & 0xc0) !== 0x80) {
        out += '\ufffd';
        i += 1;
        continue;
      }
      out += String.fromCharCode(((b & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f));
      i += 3;
    } else if ((b & 0xf8) === 0xf0) {
      if (i + 3 >= end) break;
      const b1 = bytes[i + 1];
      const b2 = bytes[i + 2];
      const b3 = bytes[i + 3];
      if ((b1 & 0xc0) !== 0x80 || (b2 & 0xc0) !== 0x80 || (b3 & 0xc0) !== 0x80) {
        out += '\ufffd';
        i += 1;
        continue;
      }
      const codePoint =
        ((b & 0x07) << 18) | ((b1 & 0x3f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f);
      if (codePoint < 0x10000 || codePoint > 0x10ffff) {
        out += '\ufffd';
      } else {
        const adjusted = codePoint - 0x10000;
        out += String.fromCharCode(
          0xd800 + (adjusted >> 10),
          0xdc00 + (adjusted & 0x03ff),
        );
      }
      i += 4;
    } else {
      out += '\ufffd';
      i += 1;
    }
  }
  return out;
};

const readUtf16 = (bytes: Uint8Array, start: number, end: number): string => {
  if (start >= end) return '';
  // BOM
  let le = false;
  let i = start;
  if (i + 1 < end && bytes[i] === 0xff && bytes[i + 1] === 0xfe) {
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
  if (start < 0 || end > bytes.length || end <= start) return '';
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

const decodeComm = (
  bytes: Uint8Array,
  start: number,
  end: number,
): { description: string; text: string } | undefined => {
  if (start < 0 || end > bytes.length || end <= start || start + 4 > end)
    return undefined;
  const enc = bytes[start];
  let p = start + 1 + 3;
  let description = '';

  if (enc === 0x01 || enc === 0x02) {
    const descStart = p;
    while (p + 1 < end && !(bytes[p] === 0 && bytes[p + 1] === 0)) p += 2;
    description = readUtf16(bytes, descStart, Math.min(p + 2, end)).trim();
    p = p + 1 < end ? p + 2 : end;
    const text = readUtf16(bytes, p, end).trim();
    return { description, text };
  }

  const descStart = p;
  while (p < end && bytes[p] !== 0) p += 1;
  description = (
    enc === 0x03 ? readUtf8(bytes, descStart, p) : readLatin1(bytes, descStart, p)
  ).trim();
  p = p < end ? p + 1 : end;
  const text = (
    enc === 0x03 ? readUtf8(bytes, p, end) : readLatin1(bytes, p, end)
  ).trim();
  return { description, text };
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const b = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out +=
      chars[(b >> 18) & 63] +
      chars[(b >> 12) & 63] +
      chars[(b >> 6) & 63] +
      chars[b & 63];
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

const buildCoverDataUri = (
  imageBytes: Uint8Array,
  mimeHint?: string,
): string | undefined => {
  if (imageBytes.length === 0) return undefined;
  const hintMime = normalizeImageMime(mimeHint);
  const magicMime = detectImageMimeFromBytes(imageBytes);
  const mime = magicMime ?? hintMime;
  if (hintMime && !magicMime) return undefined;
  if (!mime) return undefined;
  return `data:${mime};base64,${bytesToBase64(imageBytes)}`;
};

const decodeAPIC = (
  bytes: Uint8Array,
  start: number,
  end: number,
): string | undefined => {
  if (start < 0 || end > bytes.length || end <= start) return undefined;
  const enc = bytes[start];
  let p = start + 1;
  // MIME type (null-terminated latin1)
  let mimeEnd = p;
  while (mimeEnd < end && bytes[mimeEnd] !== 0) mimeEnd += 1;
  const mime = readLatin1(bytes, p, mimeEnd);
  if (mimeEnd >= end) return undefined;
  p = mimeEnd + 1;
  // picture type byte
  if (p >= end) return undefined;
  p += 1;
  // description (encoded string, null-terminated)
  if (enc === 0x01 || enc === 0x02) {
    while (p + 1 < end && !(bytes[p] === 0 && bytes[p + 1] === 0)) p += 2;
    p = p + 1 < end ? p + 2 : end;
  } else {
    while (p < end && bytes[p] !== 0) p += 1;
    p = p < end ? p + 1 : end;
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
    p = p + 1 < end ? p + 2 : end;
  } else {
    while (p < end && bytes[p] !== 0) p += 1;
    p = p < end ? p + 1 : end;
  }
  if (p >= end) return undefined;
  return buildCoverDataUri(
    bytes.subarray(p, end),
    format ? `image/${format}` : undefined,
  );
};

const skipExtendedId3Header = (
  bytes: Uint8Array,
  majorVersion: number,
  flags: number,
  start: number,
  end: number,
): number => {
  if ((flags & 0x40) === 0) return start;
  if (majorVersion === 3) {
    if (start + 4 > end) return end;
    const extendedSize = decodeSize(bytes, start);
    if (extendedSize < 6 || start + 4 + extendedSize > end) return end;
    return start + 4 + extendedSize;
  }
  if (majorVersion === 4) {
    if (start + 4 > end) return end;
    const extendedSize = decodeSyncsafe(bytes, start);
    if (extendedSize < 6 || start + extendedSize > end) return end;
    return start + extendedSize;
  }
  return start;
};

/**
 * Parse ID3 tags from a raw Uint8Array (first ~1MB of the file is usually enough).
 * Supports common ID3v2.2/v2.3/v2.4 text and cover frames.
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
  if (majorVersion !== 2 && majorVersion !== 3 && majorVersion !== 4) return tags;
  const flags = bytes[5];
  const totalSize = decodeSyncsafe(bytes, 6);
  const end = Math.min(bytes.length, 10 + totalSize);

  let p = majorVersion === 2 ? 10 : skipExtendedId3Header(bytes, majorVersion, flags, 10, end);
  let commentFallback: string | undefined;
  if (majorVersion === 2) {
    while (p + 6 <= end) {
      const id = readLatin1(bytes, p, p + 3);
      if (!id || id.charCodeAt(0) === 0) break;
      if (!/^[A-Z0-9]{3}$/.test(id)) break;
      const frameSize = (bytes[p + 3] << 16) | (bytes[p + 4] << 8) | bytes[p + 5];
      if (frameSize <= 0 || p + 6 + frameSize > end) break;
      const bodyStart = p + 6;
      const bodyEnd = bodyStart + frameSize;
      switch (id) {
        case 'TT2':
          tags.title = decodeText(bytes, bodyStart, bodyEnd);
          break;
        case 'TP1':
        case 'TP2':
          if (!tags.artist) tags.artist = decodeText(bytes, bodyStart, bodyEnd);
          break;
        case 'TAL':
          tags.album = decodeText(bytes, bodyStart, bodyEnd);
          break;
        case 'TYE':
          tags.year = decodeText(bytes, bodyStart, bodyEnd);
          break;
        case 'TCO':
          tags.genre = decodeText(bytes, bodyStart, bodyEnd);
          break;
        case 'TRK':
          tags.trackNumber = decodeText(bytes, bodyStart, bodyEnd);
          break;
        case 'TPA':
          tags.discNumber = decodeText(bytes, bodyStart, bodyEnd);
          break;
        case 'COM': {
          const comm = decodeComm(bytes, bodyStart, bodyEnd);
          if (comm?.text) {
            if (!comm.description) tags.comment = comm.text;
            else if (!commentFallback) commentFallback = comm.text;
          }
          break;
        }
        case 'PIC': {
          if (!tags.cover) {
            const cover = decodePIC(bytes, bodyStart, bodyEnd);
            if (cover) tags.cover = cover;
          }
          break;
        }
        default:
          break;
      }
      p += 6 + frameSize;
    }
    if (!tags.comment && commentFallback) tags.comment = commentFallback;
    return tags;
  }
  while (p + 10 <= end) {
    const id = readLatin1(bytes, p, p + 4);
    if (!id || id.charCodeAt(0) === 0) break;
    if (!/^[A-Z0-9]{4}$/.test(id)) break;

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
      case 'TRCK':
        tags.trackNumber = decodeText(bytes, bodyStart, bodyEnd);
        break;
      case 'TPOS':
        tags.discNumber = decodeText(bytes, bodyStart, bodyEnd);
        break;
      case 'COMM': {
        const comm = decodeComm(bytes, bodyStart, bodyEnd);
        if (comm?.text) {
          if (!comm.description) tags.comment = comm.text;
          else if (!commentFallback) commentFallback = comm.text;
        }
        break;
      }
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
  if (!tags.comment && commentFallback) tags.comment = commentFallback;
  return tags;
};

const MP4_CONTAINER_ATOMS = new Set([
  'moov',
  'udta',
  'meta',
  'ilst',
  'trak',
  'mdia',
  'minf',
  'stbl',
]);
const MP4_RELEVANT_LEAF_ATOMS = new Set(['covr', 'data']);

const parseMp4CovrData = (
  bytes: Uint8Array,
  start: number,
  end: number,
): string | undefined => {
  let p = start;
  while (p + 8 <= end) {
    const size = readU32(bytes, p);
    if (size < 8 || p + size > end) break;
    const type = readLatin1(bytes, p + 4, p + 8);
    if (size === 1) break;
    if (type === 'data' && size >= 16) {
      const payloadStart = p + 16;
      const payloadEnd = p + size;
      return buildCoverDataUri(bytes.subarray(payloadStart, payloadEnd));
    }
    p += size;
  }
  return undefined;
};

const MP4_SKIP_PAYLOAD_ATOMS = new Set(['mdat', 'free', 'skip', 'wide', 'uuid']);

const findMp4CoverAtom = (
  bytes: Uint8Array,
  start: number,
  end: number,
  depth = 0,
  trustedBoundary = false,
): string | undefined => {
  if (depth > 8) return undefined;
  let p = start;
  while (p + 8 <= end) {
    const size = readU32(bytes, p);
    if (size === 1) {
      p += 1;
      continue;
    }
    if (size < 8 || p + size > end) {
      p += 1;
      continue;
    }
    const type = readLatin1(bytes, p + 4, p + 8);
    const isContainer = MP4_CONTAINER_ATOMS.has(type);
    const isRelevantLeaf = MP4_RELEVANT_LEAF_ATOMS.has(type);
    if (!isContainer && !isRelevantLeaf) {
      if (
        trustedBoundary &&
        (MP4_SKIP_PAYLOAD_ATOMS.has(type) || /^[ -~]{4}$/.test(type))
      )
        p += size;
      else p += 1;
      continue;
    }
    const headerSize = type === 'meta' ? 12 : 8;
    const bodyStart = Math.min(p + headerSize, p + size);
    const bodyEnd = p + size;
    if (type === 'covr') {
      const cover = parseMp4CovrData(bytes, bodyStart, bodyEnd);
      if (cover) return cover;
    } else if (MP4_CONTAINER_ATOMS.has(type)) {
      const cover = findMp4CoverAtom(bytes, bodyStart, bodyEnd, depth + 1, true);
      if (cover) return cover;
    }
    p += size;
  }
  return undefined;
};

export const parseMp4CoverFromBuffer = (
  bytes: Uint8Array,
  options: { trustedTopLevel?: boolean } = {},
): string | undefined =>
  findMp4CoverAtom(bytes, 0, bytes.length, 0, options.trustedTopLevel === true);

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
 * Reads a bounded head chunk (and tail chunk for MP4-like files) to keep parsing efficient.
 */
export const parseId3FromUri = async (uri: string): Promise<Id3Tags> => {
  try {
    const encodingBase64 = (EncodingType.Base64 ?? 'base64') as 'base64';
    const normalizedUri = uri.startsWith('content://') ? uri : (uri.split('?')[0] ?? uri);
    const extensionProbeUri = uri.split('?')[0] ?? uri;
    const looksLikeMp4 = /\.(m4a|mp4|aac)$/i.test(extensionProbeUri);
    const parseHeadBytes = (bytes: Uint8Array): Id3Tags => {
      const id3 = parseId3Buffer(bytes);
      if (id3.cover) return id3;
      if (!looksLikeMp4) return id3;
      const mp4Cover = parseMp4CoverFromBuffer(bytes, { trustedTopLevel: true });
      return mp4Cover ? { ...id3, cover: mp4Cover } : id3;
    };
    try {
      const b64 = await readAsStringAsync(normalizedUri, {
        encoding: encodingBase64,
        length: HEAD_READ_LIMIT,
      });
      const bytes = base64ToBytes(b64);
      const id3 = parseHeadBytes(bytes);
      if (id3.cover || !looksLikeMp4) return id3;
      try {
        const info = await getInfoAsync(normalizedUri);
        if (!info.exists) return id3;
        const size = info.size ?? 0;
        if (size <= HEAD_READ_LIMIT) return id3;
        const tailReadLength = Math.min(TAIL_READ_LIMIT, size);
        const tailStart = Math.max(0, size - tailReadLength);
        const tailB64 = await readAsStringAsync(normalizedUri, {
          encoding: encodingBase64,
          length: tailReadLength,
          position: tailStart,
        });
        const tailCover = parseMp4CoverFromBuffer(base64ToBytes(tailB64), {
          trustedTopLevel: false,
        });
        if (tailCover) return { ...id3, cover: tailCover };
      } catch {
        return id3;
      }
      return id3;
    } catch {
      // fallback to File API when legacy path is unavailable
    }
    const FileCtor = (
      FileSystem as unknown as {
        File?: new (u: string) => { bytes: () => Promise<Uint8Array> };
      }
    ).File;
    if (!FileCtor) return {};
    try {
      const info = await getInfoAsync(normalizedUri);
      if (!info.exists) return {};
      const size = info.size ?? 0;
      if (size <= 0 || size > HEAD_READ_LIMIT) return {};
      const file = new FileCtor(normalizedUri);
      const bytes = await file.bytes();
      return parseHeadBytes(bytes.subarray(0, HEAD_READ_LIMIT));
    } catch {
      return {};
    }
  } catch {
    return {};
  }
};