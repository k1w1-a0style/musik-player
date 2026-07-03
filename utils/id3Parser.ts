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
import { decodeBase64ToBytes, encodeBytesToBase64 } from './base64';
import { detectImageMimeFromBytes, normalizeImageMime } from './imageMime';

export interface Id3Tags {
  title?: string;
  artist?: string;
  albumArtist?: string;
  album?: string;
  year?: string;
  genre?: string;
  trackNumber?: string;
  discNumber?: string;
  comment?: string;
  /** data:image/... base64 data URI */
  cover?: string;
}

const ID3V1_GENRES = [
  'Blues', 'Classic Rock', 'Country', 'Dance', 'Disco', 'Funk', 'Grunge', 'Hip-Hop',
  'Jazz', 'Metal', 'New Age', 'Oldies', 'Other', 'Pop', 'R&B', 'Rap', 'Reggae', 'Rock',
  'Techno', 'Industrial', 'Alternative', 'Ska', 'Death Metal', 'Pranks', 'Soundtrack',
  'Euro-Techno', 'Ambient', 'Trip-Hop', 'Vocal', 'Jazz+Funk', 'Fusion', 'Trance',
  'Classical', 'Instrumental', 'Acid', 'House', 'Game', 'Sound Clip', 'Gospel', 'Noise',
  'AlternRock', 'Bass', 'Soul', 'Punk', 'Space', 'Meditative', 'Instrumental Pop',
  'Instrumental Rock', 'Ethnic', 'Gothic', 'Darkwave', 'Techno-Industrial', 'Electronic',
  'Pop-Folk', 'Eurodance', 'Dream', 'Southern Rock', 'Comedy', 'Cult', 'Gangsta',
  'Top 40', 'Christian Rap', 'Pop/Funk', 'Jungle', 'Native American', 'Cabaret',
  'New Wave', 'Psychadelic', 'Rave', 'Showtunes', 'Trailer', 'Lo-Fi', 'Tribal',
  'Acid Punk', 'Acid Jazz', 'Polka', 'Retro', 'Musical', 'Rock & Roll', 'Hard Rock',
  'Folk', 'Folk-Rock', 'National Folk', 'Swing', 'Fast Fusion', 'Bebob', 'Latin',
  'Revival', 'Celtic', 'Bluegrass', 'Avantgarde', 'Gothic Rock', 'Progressive Rock',
  'Psychedelic Rock', 'Symphonic Rock', 'Slow Rock', 'Big Band', 'Chorus',
  'Easy Listening', 'Acoustic', 'Humour', 'Speech', 'Chanson', 'Opera', 'Chamber Music',
  'Sonata', 'Symphony', 'Booty Bass', 'Primus', 'Porn Groove', 'Satire', 'Slow Jam',
  'Club', 'Tango', 'Samba', 'Folklore', 'Ballad', 'Power Ballad', 'Rhythmic Soul',
  'Freestyle', 'Duet', 'Punk Rock', 'Drum Solo', 'A capella', 'Euro-House', 'Dance Hall',
  'Goa', 'Drum & Bass', 'Club-House', 'Hardcore', 'Terror', 'Indie', 'BritPop',
  'Negerpunk', 'Polsk Punk', 'Beat', 'Christian Gangsta Rap', 'Heavy Metal',
  'Black Metal', 'Crossover', 'Contemporary Christian', 'Christian Rock', 'Merengue',
  'Salsa', 'Thrash Metal', 'Anime', 'JPop', 'Synthpop',
] as const;

export const normalizeId3Genre = (value?: string): string | undefined => {
  const raw = value?.normalize('NFKC').replace(/\0/g, '').trim();
  if (!raw) return undefined;
  const parts: string[] = [];
  const addPart = (part?: string): void => {
    const cleaned = part?.replace(/[()]/g, '').replace(/\s+/gu, ' ').trim();
    if (!cleaned) return;
    if (!parts.some(existing => existing.toLocaleLowerCase('de-DE') === cleaned.toLocaleLowerCase('de-DE'))) {
      parts.push(cleaned);
    }
  };
  const addCode = (codeText: string): string | undefined => {
    const code = Number(codeText);
    const mapped = Number.isInteger(code) ? ID3V1_GENRES[code] : undefined;
    addPart(mapped ?? codeText);
    return mapped;
  };

  const wholeNumericMatch = raw.match(/^\d+$/u);
  if (wholeNumericMatch) {
    addCode(wholeNumericMatch[0]);
    return parts.join('; ') || undefined;
  }

  const parenthesizedCodeMatch = raw.match(/^\((\d+)\)(.*)$/u);
  if (parenthesizedCodeMatch) {
    const mapped = addCode(parenthesizedCodeMatch[1]);
    const suffix = parenthesizedCodeMatch[2]?.trim();
    if (suffix && (!mapped || suffix.toLocaleLowerCase('de-DE') !== mapped.toLocaleLowerCase('de-DE'))) {
      addPart(suffix);
    }
    return parts.join('; ') || undefined;
  }

  addPart(raw);
  return parts.join('; ') || undefined;
};

const HEAD_READ_LIMIT = 1024 * 1024;
const TAIL_READ_LIMIT = 1024 * 1024;
const ID3_FRAME_SCAN_LIMIT = 8 * 1024 * 1024;
const ID3_TEXT_FRAME_READ_LIMIT = 64 * 1024;

export interface ParseId3Options {
  includeCover?: boolean;
  signal?: AbortSignal;
  maxHeadBytes?: number;
  maxTailBytes?: number;
  maxFrameScanBytes?: number;
  maxFrameOffsetBytes?: number;
  maxFrameBodyReadBytes?: number;
}

const shouldIncludeCover = (options?: Pick<ParseId3Options, 'includeCover'>): boolean =>
  options?.includeCover !== false;

const throwIfParseAborted = (signal?: AbortSignal): void => {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new Error('ID3 parsing aborted');
};

const clampPositiveLimit = (value: number | undefined, fallback: number): number =>
  Number.isFinite(value) && (value as number) > 0 ? Math.floor(value as number) : fallback;

const clampNonNegativeLimit = (value: number | undefined, fallback: number): number =>
  Number.isFinite(value) && (value as number) >= 0 ? Math.floor(value as number) : fallback;

type Id3FileInfo = { exists: boolean; size: number };

const getId3FileInfo = async (uri: string): Promise<Id3FileInfo> => {
  // Keep legacy getInfo localized: modern Paths.info lacks file size and File.info
  // can throw for provider-backed/non-file URIs. The deprecated risk is isolated here;
  // migrate when the modern API exposes async, URI-compatible exists+size metadata.
  const info = (await getInfoAsync(uri)) as { exists?: boolean; size?: unknown } | undefined;
  return {
    exists: Boolean(info?.exists),
    size: typeof info?.size === 'number' ? info.size : 0,
  };
};

const warnLargeBytesFallbackSkipped = (uri: string, size: number): void => {
  console.warn(
    '[ID3Parser] Skipping File.bytes fallback for large file without range read support.',
    { uri, size, limit: HEAD_READ_LIMIT },
  );
};

const decodeSyncsafe = (bytes: Uint8Array, off: number): number | undefined => {
  if (off < 0 || off + 4 > bytes.length) return undefined;
  const b0 = bytes[off];
  const b1 = bytes[off + 1];
  const b2 = bytes[off + 2];
  const b3 = bytes[off + 3];
  if (b0 > 0x7f || b1 > 0x7f || b2 > 0x7f || b3 > 0x7f) return undefined;
  return (b0 << 21) | (b1 << 14) | (b2 << 7) | b3;
};

const decodeSize = (bytes: Uint8Array, off: number): number | undefined => {
  if (off < 0 || off + 4 > bytes.length) return undefined;
  return (
    (bytes[off] << 24) | (bytes[off + 1] << 16) | (bytes[off + 2] << 8) | bytes[off + 3]
  ) >>> 0;
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

const bytesToBase64 = (bytes: Uint8Array): string => encodeBytesToBase64(bytes);

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

const removeUnsynchronization = (bytes: Uint8Array): Uint8Array => {
  const out: number[] = [];
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i];
    out.push(byte);
    if (byte === 0xff && bytes[i + 1] === 0x00) i += 1;
  }
  return new Uint8Array(out);
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
    const extendedSize = decodeSize(bytes, start);
    if (extendedSize === undefined || extendedSize < 6 || start + 4 + extendedSize > end) return end;
    return start + 4 + extendedSize;
  }
  if (majorVersion === 4) {
    const extendedSize = decodeSyncsafe(bytes, start);
    if (extendedSize === undefined || extendedSize < 6 || start + extendedSize > end) return end;
    return start + extendedSize;
  }
  return start;
};

const hasUnsupportedFrameFlags = (majorVersion: number, flag1: number, flag2: number): boolean => {
  if (majorVersion === 3) return (flag2 & 0xe0) !== 0;
  if (majorVersion === 4) return (flag2 & 0x4d) !== 0;
  return false;
};

const hasFrameUnsynchronization = (majorVersion: number, flag2: number): boolean =>
  majorVersion === 4 && (flag2 & 0x02) !== 0;

/**
 * Parse ID3 tags from a raw Uint8Array (first ~1MB of the file is usually enough).
 * Supports common ID3v2.2/v2.3/v2.4 text and cover frames.
 */
export const parseId3Buffer = (bytes: Uint8Array, options: Pick<ParseId3Options, 'includeCover'> = {}): Id3Tags => {
  const includeCover = shouldIncludeCover(options);
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
  if (totalSize === undefined) return tags;
  const rawEnd = Math.min(bytes.length, 10 + totalSize);
  const rawTagBytes = bytes.subarray(10, rawEnd);
  const hasTagUnsynchronization = (flags & 0x80) !== 0;
  const rawTagEnd = rawTagBytes.length;
  const rawFrameStart = majorVersion === 2
    ? 0
    : skipExtendedId3Header(rawTagBytes, majorVersion, flags, 0, rawTagEnd);
  const frameBytesForWalk = hasTagUnsynchronization
    ? removeUnsynchronization(rawTagBytes.subarray(rawFrameStart, rawTagEnd))
    : rawTagBytes.subarray(rawFrameStart, rawTagEnd);
  const end = frameBytesForWalk.length;

  let p = 0;
  let commentFallback: string | undefined;
  if (majorVersion === 2) {
    while (p + 6 <= end) {
      const id = readLatin1(frameBytesForWalk, p, p + 3);
      if (!id || id.charCodeAt(0) === 0) break;
      if (!/^[A-Z0-9]{3}$/.test(id)) break;
      const frameSize = (frameBytesForWalk[p + 3] << 16) | (frameBytesForWalk[p + 4] << 8) | frameBytesForWalk[p + 5];
      if (frameSize <= 0 || p + 6 + frameSize > end) break;
      const bodyStart = p + 6;
      const bodyEnd = bodyStart + frameSize;
      const frameBytes = frameBytesForWalk;
      switch (id) {
        case 'TT2':
          tags.title = decodeText(frameBytes, bodyStart, bodyEnd);
          break;
        case 'TP1':
          tags.artist = decodeText(frameBytes, bodyStart, bodyEnd);
          break;
        case 'TP2':
          tags.albumArtist = decodeText(frameBytes, bodyStart, bodyEnd);
          break;
        case 'TAL':
          tags.album = decodeText(frameBytes, bodyStart, bodyEnd);
          break;
        case 'TYE':
          tags.year = decodeText(frameBytes, bodyStart, bodyEnd);
          break;
        case 'TCO':
          tags.genre = normalizeId3Genre(decodeText(frameBytes, bodyStart, bodyEnd));
          break;
        case 'TRK':
          tags.trackNumber = decodeText(frameBytes, bodyStart, bodyEnd);
          break;
        case 'TPA':
          tags.discNumber = decodeText(frameBytes, bodyStart, bodyEnd);
          break;
        case 'COM': {
          const comm = decodeComm(frameBytes, bodyStart, bodyEnd);
          if (comm?.text) {
            if (!comm.description) tags.comment = comm.text;
            else if (!commentFallback) commentFallback = comm.text;
          }
          break;
        }
        case 'PIC': {
          if (includeCover && !tags.cover) {
            const cover = decodePIC(frameBytes, bodyStart, bodyEnd);
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
    const id = readLatin1(frameBytesForWalk, p, p + 4);
    if (!id || id.charCodeAt(0) === 0) break;
    if (!/^[A-Z0-9]{4}$/.test(id)) break;

    const frameSize =
      majorVersion === 4 ? decodeSyncsafe(frameBytesForWalk, p + 4) : decodeSize(frameBytesForWalk, p + 4);
    if (frameSize === undefined || frameSize <= 0 || p + 10 + frameSize > end) break;

    const frameFlag1 = frameBytesForWalk[p + 8];
    const frameFlag2 = frameBytesForWalk[p + 9];
    if (hasUnsupportedFrameFlags(majorVersion, frameFlag1, frameFlag2)) {
      p += 10 + frameSize;
      continue;
    }

    const rawBodyStart = p + 10;
    const rawBodyEnd = rawBodyStart + frameSize;
    const shouldRemoveFrameUnsync = !hasTagUnsynchronization && hasFrameUnsynchronization(majorVersion, frameFlag2);
    const frameBytes = shouldRemoveFrameUnsync
      ? removeUnsynchronization(frameBytesForWalk.subarray(rawBodyStart, rawBodyEnd))
      : frameBytesForWalk;
    const bodyStart = shouldRemoveFrameUnsync ? 0 : rawBodyStart;
    const bodyEnd = shouldRemoveFrameUnsync ? frameBytes.length : rawBodyEnd;

    switch (id) {
      case 'TIT2':
        tags.title = decodeText(frameBytes, bodyStart, bodyEnd);
        break;
      case 'TPE1':
        tags.artist = decodeText(frameBytes, bodyStart, bodyEnd);
        break;
      case 'TPE2':
        tags.albumArtist = decodeText(frameBytes, bodyStart, bodyEnd);
        break;
      case 'TALB':
        tags.album = decodeText(frameBytes, bodyStart, bodyEnd);
        break;
      case 'TYER':
      case 'TDRC':
        tags.year = decodeText(frameBytes, bodyStart, bodyEnd);
        break;
      case 'TCON':
        tags.genre = normalizeId3Genre(decodeText(frameBytes, bodyStart, bodyEnd));
        break;
      case 'TRCK':
        tags.trackNumber = decodeText(frameBytes, bodyStart, bodyEnd);
        break;
      case 'TPOS':
        tags.discNumber = decodeText(frameBytes, bodyStart, bodyEnd);
        break;
      case 'COMM': {
        const comm = decodeComm(frameBytes, bodyStart, bodyEnd);
        if (comm?.text) {
          if (!comm.description) tags.comment = comm.text;
          else if (!commentFallback) commentFallback = comm.text;
        }
        break;
      }
      case 'APIC':
        if (includeCover && !tags.cover) {
          const cover = decodeAPIC(frameBytes, bodyStart, bodyEnd);
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
const MP4_TEXT_ATOM_TAGS: Record<string, keyof Id3Tags> = {
  '©nam': 'title',
  '©ART': 'artist',
  aART: 'albumArtist',
  '©alb': 'album',
  '©day': 'year',
  '©gen': 'genre',
  '©cmt': 'comment',
};
const MP4_NUMBER_ATOM_TAGS: Record<string, keyof Id3Tags> = {
  trkn: 'trackNumber',
  disk: 'discNumber',
};
const MP4_RELEVANT_LEAF_ATOMS = new Set(['covr', 'data', ...Object.keys(MP4_TEXT_ATOM_TAGS), ...Object.keys(MP4_NUMBER_ATOM_TAGS)]);


const decodeMp4Utf8 = (bytes: Uint8Array): string => {
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/\0+$/g, '').trim();
  } catch {
    return readLatin1(bytes, 0, bytes.length).replace(/\0+$/g, '').trim();
  }
};

const parseMp4DataPayloads = (
  bytes: Uint8Array,
  start: number,
  end: number,
  onPayload: (payload: Uint8Array) => void,
): void => {
  let p = start;
  while (p + 8 <= end) {
    const size = readU32(bytes, p);
    if (size < 8 || p + size > end) break;
    const type = readLatin1(bytes, p + 4, p + 8);
    if (size === 1) break;
    if (type === 'data' && size >= 16) {
      onPayload(bytes.subarray(p + 16, p + size));
    }
    p += size;
  }
};

const parseMp4TextAtom = (bytes: Uint8Array, start: number, end: number): string | undefined => {
  let value: string | undefined;
  parseMp4DataPayloads(bytes, start, end, payload => {
    if (value) return;
    const text = decodeMp4Utf8(payload);
    if (text) value = text;
  });
  return value;
};

const readU16 = (bytes: Uint8Array, offset: number): number =>
  ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);

const parseMp4NumberAtom = (bytes: Uint8Array, start: number, end: number): string | undefined => {
  let value: string | undefined;
  parseMp4DataPayloads(bytes, start, end, payload => {
    if (value || payload.length < 4) return;
    const numbers: number[] = [];
    for (let i = 0; i + 1 < payload.length; i += 2) {
      const number = readU16(payload, i);
      if (number > 0) numbers.push(number);
      if (numbers.length >= 2) break;
    }
    if (numbers.length === 1) value = String(numbers[0]);
    else if (numbers.length >= 2) value = `${numbers[0]}/${numbers[1]}`;
  });
  return value;
};

const assignMp4Tag = (tags: Id3Tags, key: keyof Id3Tags, value?: string): void => {
  if (!value || tags[key]) return;
  tags[key] = value;
};

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

const findMp4Tags = (
  bytes: Uint8Array,
  start: number,
  end: number,
  options: { includeCover: boolean; depth?: number; trustedBoundary?: boolean },
): Id3Tags => {
  const tags: Id3Tags = {};
  const depth = options.depth ?? 0;
  const trustedBoundary = options.trustedBoundary === true;
  if (depth > 8) return tags;
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
    if (type === 'covr' && options.includeCover) {
      assignMp4Tag(tags, 'cover', parseMp4CovrData(bytes, bodyStart, bodyEnd));
    } else if (type in MP4_TEXT_ATOM_TAGS) {
      assignMp4Tag(tags, MP4_TEXT_ATOM_TAGS[type], parseMp4TextAtom(bytes, bodyStart, bodyEnd));
    } else if (type in MP4_NUMBER_ATOM_TAGS) {
      assignMp4Tag(tags, MP4_NUMBER_ATOM_TAGS[type], parseMp4NumberAtom(bytes, bodyStart, bodyEnd));
    } else if (MP4_CONTAINER_ATOMS.has(type)) {
      Object.assign(tags, mergeId3Tags(tags, findMp4Tags(bytes, bodyStart, bodyEnd, { includeCover: options.includeCover, depth: depth + 1, trustedBoundary: true })));
    }
    p += size;
  }
  return tags;
};

export const parseMp4TagsFromBuffer = (
  bytes: Uint8Array,
  options: { includeCover?: boolean; trustedTopLevel?: boolean } = {},
): Id3Tags =>
  findMp4Tags(bytes, 0, bytes.length, { includeCover: options.includeCover !== false, trustedBoundary: options.trustedTopLevel === true });

export const parseMp4CoverFromBuffer = (
  bytes: Uint8Array,
  options: { trustedTopLevel?: boolean } = {},
): string | undefined =>
  parseMp4TagsFromBuffer(bytes, { includeCover: true, trustedTopLevel: options.trustedTopLevel }).cover;

const base64ToBytes = (b64: string): Uint8Array => decodeBase64ToBytes(b64);

const TEXT_FRAME_IDS: Record<string, keyof Id3Tags> = {
  TIT2: 'title',
  TPE1: 'artist',
  TPE2: 'albumArtist',
  TALB: 'album',
  TYER: 'year',
  TDRC: 'year',
  TCON: 'genre',
  TRCK: 'trackNumber',
  TPOS: 'discNumber',
  TT2: 'title',
  TP1: 'artist',
  TP2: 'albumArtist',
  TAL: 'album',
  TYE: 'year',
  TCO: 'genre',
  TRK: 'trackNumber',
  TPA: 'discNumber',
};

const PARSER_PLACEHOLDER_TAG_VALUES = new Set(['unknown', 'undefined', 'null', '<unknown>']);

const isUsableParsedTagValue = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const normalized = value.normalize('NFKC').replace(/\s+/gu, ' ').trim();
  return normalized.length > 0 && !PARSER_PLACEHOLDER_TAG_VALUES.has(normalized.toLocaleLowerCase('en-US'));
};

const mergeId3Tags = (base: Id3Tags, patch: Id3Tags): Id3Tags => ({
  ...base,
  ...Object.fromEntries(
    Object.entries(patch).filter(([, value]) => isUsableParsedTagValue(value)),
  ),
});

const mergeMissingOrPlaceholderId3Tags = (base: Id3Tags, patch: Id3Tags): Id3Tags => {
  const merged: Id3Tags = { ...base };
  for (const [key, value] of Object.entries(patch) as Array<[keyof Id3Tags, string | undefined]>) {
    // MP4 tail/head fallback tags should replace empty or parser-placeholder values,
    // but must not overwrite already useful ID3/head metadata.
    if (isUsableParsedTagValue(value) && !isUsableParsedTagValue(merged[key])) {
      merged[key] = value;
    }
  }
  return merged;
};

const applyTextFrame = (tags: Id3Tags, id: string, frameBytes: Uint8Array): void => {
  if (id === 'COMM' || id === 'COM') {
    const comm = decodeComm(frameBytes, 0, frameBytes.length);
    if (comm?.text && !tags.comment) tags.comment = comm.text;
    return;
  }
  const key = TEXT_FRAME_IDS[id];
  if (!key) return;
  if ((key === 'artist' && tags.artist) || (key === 'albumArtist' && tags.albumArtist)) return;
  const text = key === 'genre'
    ? normalizeId3Genre(decodeText(frameBytes, 0, frameBytes.length))
    : decodeText(frameBytes, 0, frameBytes.length);
  if (text) tags[key] = text;
};

type ReadRange = (position: number, length: number) => Promise<Uint8Array>;

const parseId3TextFramesByRange = async (
  initialBytes: Uint8Array,
  readRange: ReadRange,
  options: Pick<ParseId3Options, 'signal' | 'maxFrameScanBytes' | 'maxFrameOffsetBytes' | 'maxFrameBodyReadBytes'> = {},
): Promise<Id3Tags> => {
  const tags: Id3Tags = {};
  if (
    initialBytes.length < 10 ||
    initialBytes[0] !== 0x49 ||
    initialBytes[1] !== 0x44 ||
    initialBytes[2] !== 0x33
  ) {
    return tags;
  }
  const majorVersion = initialBytes[3];
  if (majorVersion !== 2 && majorVersion !== 3 && majorVersion !== 4) return tags;
  const flags = initialBytes[5];
  if ((flags & 0x80) !== 0) return tags;
  const totalSize = decodeSyncsafe(initialBytes, 6);
  if (totalSize === undefined) return tags;
  const scanEnd = Math.min(10 + totalSize, clampPositiveLimit(options.maxFrameOffsetBytes, ID3_FRAME_SCAN_LIMIT));
  const bodyReadLimit = clampNonNegativeLimit(
    options.maxFrameBodyReadBytes ?? options.maxFrameScanBytes,
    ID3_FRAME_SCAN_LIMIT,
  );
  let bodyBytesRead = 0;
  let p = 10;
  if (majorVersion !== 2) {
    const rawTagEnd = Math.min(initialBytes.length, scanEnd) - 10;
    p += skipExtendedId3Header(
      initialBytes.subarray(10, Math.min(initialBytes.length, scanEnd)),
      majorVersion,
      flags,
      0,
      rawTagEnd,
    );
  }

  while (p + (majorVersion === 2 ? 6 : 10) <= scanEnd) {
    throwIfParseAborted(options.signal);
    const headerLength = majorVersion === 2 ? 6 : 10;
    const header = p + headerLength <= initialBytes.length
      ? initialBytes.subarray(p, p + headerLength)
      : await readRange(p, headerLength);
    throwIfParseAborted(options.signal);
    if (header.length < headerLength) break;
    const id = readLatin1(header, 0, majorVersion === 2 ? 3 : 4);
    if (!id || id.charCodeAt(0) === 0) break;
    if (!new RegExp(`^[A-Z0-9]{${majorVersion === 2 ? 3 : 4}}$`).test(id)) break;
    const frameSize = majorVersion === 2
      ? (header[3] << 16) | (header[4] << 8) | header[5]
      : majorVersion === 4
        ? decodeSyncsafe(header, 4)
        : decodeSize(header, 4);
    if (frameSize === undefined || frameSize <= 0) break;
    if (majorVersion !== 2 && hasUnsupportedFrameFlags(majorVersion, header[8], header[9])) {
      p += headerLength + frameSize;
      continue;
    }
    if (
      (id in TEXT_FRAME_IDS || id === 'COMM' || id === 'COM') &&
      frameSize <= ID3_TEXT_FRAME_READ_LIMIT &&
      bodyBytesRead + frameSize <= bodyReadLimit
    ) {
      const bodyStart = p + headerLength;
      const body = bodyStart + frameSize <= initialBytes.length
        ? initialBytes.subarray(bodyStart, bodyStart + frameSize)
        : await readRange(bodyStart, frameSize);
      throwIfParseAborted(options.signal);
      if (body.length === frameSize) {
        bodyBytesRead += frameSize;
        applyTextFrame(tags, id, body);
      }
    }
    p += headerLength + frameSize;
  }
  return tags;
};

/**
 * Read & parse ID3 tags from a file URI (e.g. from expo-media-library or expo-document-picker).
 * Reads a bounded head chunk (and tail chunk for MP4-like files) to keep parsing efficient.
 */
export const parseId3FromUri = async (uri: string, options: ParseId3Options = {}): Promise<Id3Tags> => {
  try {
    throwIfParseAborted(options.signal);
    const includeCover = shouldIncludeCover(options);
    const maxHeadBytes = clampPositiveLimit(options.maxHeadBytes, HEAD_READ_LIMIT);
    const maxTailBytes = clampNonNegativeLimit(options.maxTailBytes, TAIL_READ_LIMIT);
    const maxFrameOffsetBytes = clampPositiveLimit(options.maxFrameOffsetBytes, ID3_FRAME_SCAN_LIMIT);
    const maxFrameBodyReadBytes = clampNonNegativeLimit(
      options.maxFrameBodyReadBytes ?? options.maxFrameScanBytes,
      ID3_FRAME_SCAN_LIMIT,
    );
    const encodingBase64 = (EncodingType.Base64 ?? 'base64') as 'base64';
    const normalizedUri = uri.startsWith('content://') ? uri : (uri.split('?')[0] ?? uri);
    const extensionProbeUri = uri.split('?')[0] ?? uri;
    const looksLikeMp4 = /\.(m4a|mp4|aac)$/i.test(extensionProbeUri);
    const parseHeadBytes = (bytes: Uint8Array): Id3Tags => {
      const id3 = parseId3Buffer(bytes, { includeCover });
      if (!looksLikeMp4) return id3;
      return mergeMissingOrPlaceholderId3Tags(id3, parseMp4TagsFromBuffer(bytes, { includeCover, trustedTopLevel: true }));
    };
    const mergeMp4TailTags = async (currentTags: Id3Tags, size: number, readTail: (tailStart: number, tailReadLength: number) => Promise<Uint8Array>): Promise<Id3Tags> => {
      if (!looksLikeMp4 || size <= maxHeadBytes || maxTailBytes <= 0) return currentTags;
      const tailReadLength = Math.min(maxTailBytes, size);
      const tailStart = Math.max(0, size - tailReadLength);
      const tailBytes = await readTail(tailStart, tailReadLength);
      throwIfParseAborted(options.signal);
      const tailTags = parseMp4TagsFromBuffer(tailBytes, {
        includeCover,
        trustedTopLevel: false,
      });
      return mergeMissingOrPlaceholderId3Tags(currentTags, tailTags);
    };
    try {
      const b64 = await readAsStringAsync(normalizedUri, {
        encoding: encodingBase64,
        length: maxHeadBytes,
      });
      const bytes = base64ToBytes(b64);
      const readRange = async (position: number, length: number): Promise<Uint8Array> =>
        base64ToBytes(
          await readAsStringAsync(normalizedUri, {
            encoding: encodingBase64,
            length,
            position,
          }),
        );
      throwIfParseAborted(options.signal);
      let id3 = parseHeadBytes(bytes);
      if (
        !id3.cover &&
        bytes.length >= 10 &&
        bytes[0] === 0x49 &&
        bytes[1] === 0x44 &&
        bytes[2] === 0x33
      ) {
        try {
          id3 = mergeId3Tags(id3, await parseId3TextFramesByRange(bytes, readRange, { signal: options.signal, maxFrameOffsetBytes, maxFrameBodyReadBytes }));
        } catch (error) {
          throwIfParseAborted(options.signal);
          console.warn('[ID3Parser] Bounded ID3 frame scan failed.', error);
        }
      }
      if (!looksLikeMp4) return id3;
      try {
        const info = await getId3FileInfo(normalizedUri);
        if (!info.exists) return id3;
        return await mergeMp4TailTags(id3, info.size, async (tailStart, tailReadLength) => {
          const tailB64 = await readAsStringAsync(normalizedUri, {
            encoding: encodingBase64,
            length: tailReadLength,
            position: tailStart,
          });
          return base64ToBytes(tailB64);
        });
      } catch {
        throwIfParseAborted(options.signal);
        return id3;
      }
    } catch {
      throwIfParseAborted(options.signal);
      // fallback to File API when legacy path is unavailable
    }
    const FileCtor = (
      FileSystem as unknown as {
        File?: new (u: string) => {
          bytes: () => Promise<Uint8Array>;
          open?: () => {
            readBytes: (length: number) => Uint8Array;
            offset: number | null;
            close?: () => void;
          };
        };
      }
    ).File;
    if (!FileCtor) return {};
    try {
      const info = await getId3FileInfo(normalizedUri);
      if (!info.exists) return {};
      const size = info.size;
      if (size <= 0) return {};
      const file = new FileCtor(normalizedUri);
      const open = (
        file as {
          open?: () => {
            readBytes: (length: number) => Uint8Array;
            offset: number | null;
            close?: () => void;
          };
        }
      ).open;
      if (typeof open === 'function') {
        const handle = open.call(file);
        if (handle) {
          try {
            throwIfParseAborted(options.signal);
            const head = handle.readBytes(Math.min(maxHeadBytes, size));
            const readRange = async (position: number, length: number): Promise<Uint8Array> => {
              handle.offset = position;
              return handle.readBytes(length);
            };
            let parsed = parseHeadBytes(head);
            if (
              head.length >= 10 &&
              head[0] === 0x49 &&
              head[1] === 0x44 &&
              head[2] === 0x33
            ) {
              parsed = mergeId3Tags(parsed, await parseId3TextFramesByRange(head, readRange, { signal: options.signal, maxFrameOffsetBytes, maxFrameBodyReadBytes }));
            }
            if (looksLikeMp4) {
              parsed = await mergeMp4TailTags(parsed, size, async (tailStart, tailReadLength) => {
                handle.offset = tailStart;
                return handle.readBytes(tailReadLength);
              });
            }
            return parsed;
          } finally {
            handle.close?.();
          }
        }
      }
      if (size > maxHeadBytes) {
        // File.bytes() loads the entire file. Without File.open()/range reads, large
        // media must return a controlled empty result rather than risk a memory spike.
        warnLargeBytesFallbackSkipped(normalizedUri, size);
        return {};
      }
      const bytes = await file.bytes();
      throwIfParseAborted(options.signal);
      return parseHeadBytes(bytes.subarray(0, maxHeadBytes));
    } catch {
      throwIfParseAborted(options.signal);
      return {};
    }
  } catch {
    throwIfParseAborted(options.signal);
    return {};
  }
};