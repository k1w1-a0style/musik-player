import type { SongMetadataField } from '../types/Song';

const FRAME_FIELDS: Record<string, SongMetadataField> = {
  TALB: 'album', TAL: 'album', TPE2: 'albumArtist', TP2: 'albumArtist',
  TYER: 'year', TYE: 'year', TDRC: 'year', TCON: 'genre', TCO: 'genre',
  TRCK: 'trackNumber', TRK: 'trackNumber', TPOS: 'discNumber', TPA: 'discNumber',
  COMM: 'comment', COM: 'comment', APIC: 'cover', PIC: 'cover',
};
const OPTIONAL_FIELDS: SongMetadataField[] = ['album', 'albumArtist', 'year', 'genre', 'trackNumber', 'discNumber', 'comment', 'cover'];
const ascii = (bytes: Uint8Array, start: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(start, start + length));
const syncsafe = (bytes: Uint8Array, start: number): number | undefined => {
  const part = bytes.subarray(start, start + 4);
  return part.length === 4 && part.every(value => value < 128)
    ? part.reduce((size, value) => size * 128 + value, 0) : undefined;
};
const mpegFrameLength = (bytes: Uint8Array, start: number): number | undefined => {
  const frame = bytes.subarray(start, start + 4);
  if (frame.length !== 4 || frame[0] !== 255 || (frame[1] & 224) !== 224 || (frame[1] & 6) !== 2) return undefined;
  const version = (frame[1] >> 3) & 3;
  const bitrateIndex = frame[2] >> 4;
  const rateIndex = (frame[2] >> 2) & 3;
  if (version === 1 || bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) return undefined;
  const bitrate = (version === 3 ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
    : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160])[bitrateIndex];
  const sampleRate = [44100, 48000, 32000][rateIndex] / (version === 3 ? 1 : version === 2 ? 2 : 4);
  return Math.floor((version === 3 ? 144 : 72) * bitrate * 1000 / sampleRate) + ((frame[2] >> 1) & 1);
};
const mpegStream = (bytes: Uint8Array, start: number): boolean => {
  const length = mpegFrameLength(bytes, start);
  return length !== undefined && mpegFrameLength(bytes, start + length) !== undefined;
};

/** Only a complete, untransformed ID3v2 tag or an MPEG stream proves absence.
 * Truncated, unsupported and foreign containers remain unknown. */
const supportedTagEnd = (head: Uint8Array): number | undefined => {
  const size = syncsafe(head, 6);
  if (![2, 3, 4].includes(head[3]) || head[4] !== 0 || head[5] !== 0 || size === undefined) return undefined;
  return 10 + size <= head.length && mpegStream(head, 10 + size) ? 10 + size : undefined;
};
const readFrame = (head: Uint8Array, position: number, version: number, end: number) => {
  const idLength = version === 2 ? 3 : 4;
  const headerLength = version === 2 ? 6 : 10;
  if (position + headerLength > end) return undefined;
  const id = ascii(head, position, idLength);
  if (!new RegExp(`^[A-Z0-9]{${idLength}}$`).test(id)) return undefined;
  const frameSize = version === 4 ? syncsafe(head, position + 4)
    : head.subarray(position + idLength, position + idLength + (version === 2 ? 3 : 4))
      .reduce((value, byte) => value * 256 + byte, 0);
  if (frameSize === undefined || frameSize <= 0 || position + headerLength + frameSize > end) return undefined;
  if (version !== 2 && (head[position + 8] !== 0 || head[position + 9] !== 0)) return undefined;
  return { field: FRAME_FIELDS[id], length: headerLength + frameSize };
};
const readPresentFields = (head: Uint8Array, end: number): Set<SongMetadataField> | undefined => {
  const present = new Set<SongMetadataField>();
  let position = 10;
  while (position < end) {
    if (head[position] === 0) {
      if (!head.subarray(position, end).every(value => value === 0)) return undefined;
      break;
    }
    const frame = readFrame(head, position, head[3], end);
    if (!frame) return undefined;
    if (frame.field) present.add(frame.field);
    position += frame.length;
  }
  return present;
};
export const inspectId3MissingFields = (head: Uint8Array, includeCover: boolean): SongMetadataField[] | undefined => {
  if (ascii(head, 0, 3) !== 'ID3') return mpegStream(head, 0)
    ? OPTIONAL_FIELDS.filter(field => includeCover || field !== 'cover') : undefined;
  const end = supportedTagEnd(head);
  const present = end !== undefined ? readPresentFields(head, end) : undefined;
  if (!present) return undefined;
  return OPTIONAL_FIELDS.filter(field => !present.has(field) && (includeCover || field !== 'cover'));
};

/** Tail metadata is not fully parsed here. Its presence makes absence unknown. */
export const hasLegacyTailMetadata = (tail: Uint8Array): boolean => {
  const text = ascii(tail, 0, tail.length);
  return text.includes('APETAGEX') || text.includes('LYRICS200') || text.includes('LYRICSEND')
    || text.includes('TAG+') || (tail.length >= 128 && ascii(tail, tail.length - 128, 3) === 'TAG')
    || text.includes('3DI');
};
