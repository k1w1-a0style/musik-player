/** Read-only native FLAC metadata: RFC 9639 sections 8.1, 8.2 and 8.6.
 * Never searches audio/picture bytes for strings and never changes the source.
 */
import type { Id3Tags } from './id3Parser';

type TextField = Exclude<keyof Id3Tags, 'cover' | 'metadataInspection'>;
const MAX_BLOCKS = 128;
const MAX_METADATA_OFFSET = 8 * 1024 * 1024;
const MAX_COMMENT_BYTES = 128 * 1024;
const MAX_VECTOR_BYTES = 64 * 1024;
const MAX_COMMENTS = 1024;
const FIELD_NAMES: Readonly<Record<string, TextField>> = {
  TITLE: 'title', ARTIST: 'artist', ALBUM: 'album', ALBUMARTIST: 'albumArtist',
  'ALBUM ARTIST': 'albumArtist', DATE: 'year', YEAR: 'year', GENRE: 'genre',
  TRACKNUMBER: 'trackNumber', DISCNUMBER: 'discNumber', COMMENT: 'comment', DESCRIPTION: 'comment',
};

const startsWith = (bytes: Uint8Array, offset: number, text: string): boolean =>
  offset >= 0 && offset + text.length <= bytes.length
  && Array.from(text).every((character, index) => bytes[offset + index] === character.charCodeAt(0));

const flacOffset = (bytes: Uint8Array): number | undefined => {
  if (startsWith(bytes, 0, 'fLaC')) return 0;
  if (bytes.length < 10 || !startsWith(bytes, 0, 'ID3')) return undefined;
  if (![2, 3, 4].includes(bytes[3]) || bytes.subarray(6, 10).some(value => value >= 128)) return undefined;
  const size = Array.from(bytes.subarray(6, 10)).reduce((result, value) => result * 128 + value, 0);
  const footer = bytes[3] === 4 && (bytes[5] & 0x10) !== 0 ? 10 : 0;
  const offset = 10 + size + footer;
  return offset <= MAX_METADATA_OFFSET ? offset : undefined;
};

interface MetadataBlock { type: number; length: number; body: number; end: number; last: boolean }
const metadataBlock = (bytes: Uint8Array, offset: number): MetadataBlock | undefined => {
  if (offset + 4 > bytes.length || offset > MAX_METADATA_OFFSET) return undefined;
  const type = bytes[offset] & 0x7f;
  if (type === 127) return undefined;
  const length = bytes[offset + 1] * 65536 + bytes[offset + 2] * 256 + bytes[offset + 3];
  return { type, length, body: offset + 4, end: offset + 4 + length, last: (bytes[offset] & 0x80) !== 0 };
};

interface CommentCursor { bytes: Uint8Array; position: number; decoder: TextDecoder }
const readU32LE = (cursor: CommentCursor): number => {
  if (cursor.position + 4 > cursor.bytes.length) throw new Error('Truncated Vorbis length');
  const value = new DataView(cursor.bytes.buffer, cursor.bytes.byteOffset + cursor.position, 4).getUint32(0, true);
  cursor.position += 4;
  return value;
};

const readVector = (cursor: CommentCursor): string => {
  const length = readU32LE(cursor);
  if (length > MAX_VECTOR_BYTES || cursor.position + length > cursor.bytes.length) throw new Error('Invalid Vorbis vector');
  const value = cursor.decoder.decode(cursor.bytes.subarray(cursor.position, cursor.position + length));
  cursor.position += length;
  return value;
};

const collectField = (text: string, values: Map<TextField, string[]>): void => {
  const separator = text.indexOf('=');
  if (separator <= 0) return;
  const name = text.slice(0, separator);
  if (!/^[\x20-\x3c\x3e-\x7e]+$/.test(name)) return;
  const field = FIELD_NAMES[name.toUpperCase()];
  const value = text.slice(separator + 1).trim();
  if (!field || !value || value.includes('\0')) return;
  const previous = values.get(field) ?? [];
  if (!previous.includes(value)) values.set(field, [...previous, value]);
};

const resolveFields = (values: Map<TextField, string[]>): Id3Tags => {
  const result: Id3Tags = {};
  values.forEach((entries, field) => {
    // Multiple ARTIST/GENRE vectors are legitimate. Conflicting singleton
    // fields remain absent rather than choosing the first or last silently.
    if (field === 'artist' || field === 'genre') result[field] = entries.join('; ');
    else if (entries.length === 1) result[field] = entries[0];
  });
  return result;
};

const parseComment = (bytes: Uint8Array): Id3Tags => {
  if (bytes.length > MAX_COMMENT_BYTES) return {};
  try {
    const cursor: CommentCursor = { bytes, position: 0, decoder: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }) };
    readVector(cursor); // Vendor is validated but is never an artist/publisher.
    const count = readU32LE(cursor);
    if (count > MAX_COMMENTS) return {};
    const values = new Map<TextField, string[]>();
    for (let index = 0; index < count; index += 1) collectField(readVector(cursor), values);
    // FLAC has no Vorbis framing bit; any undeclared/truncated bytes invalidate
    // this receipt instead of returning a partially parsed authoritative tag.
    return cursor.position === bytes.length ? resolveFields(values) : {};
  } catch {
    return {};
  }
};

export const parseFlacVorbisMetadata = (bytes: Uint8Array): Id3Tags => {
  const start = flacOffset(bytes);
  if (start === undefined || !startsWith(bytes, start, 'fLaC')) return {};
  const streamInfo = metadataBlock(bytes, start + 4);
  if (!streamInfo || streamInfo.type !== 0 || streamInfo.length !== 34 || streamInfo.end > bytes.length) return {};
  if (streamInfo.last) return {};
  let offset = streamInfo.end;
  for (let index = 1; index < MAX_BLOCKS; index += 1) {
    const block = metadataBlock(bytes, offset);
    if (!block || block.type === 0 || block.end > bytes.length) return {};
    if (block.type === 4) return parseComment(bytes.subarray(block.body, block.end));
    if (block.last) return {};
    offset = block.end;
  }
  return {};
};


interface FlacRangeOptions { signal?: AbortSignal; maxMetadataOffsetBytes?: number; maxExtraReadBytes?: number }
type ReadRange = (position: number, length: number) => Promise<Uint8Array>;

const abortIfRequested = (signal?: AbortSignal): void => {
  if (!signal?.aborted) return;
  const error = new Error('FLAC metadata read aborted');
  error.name = 'AbortError';
  throw error;
};

const boundedLimit = (requested: number | undefined, ceiling: number): number =>
  requested === undefined ? ceiling : Math.min(ceiling, Math.max(0, Math.floor(requested)) || 0);

const createRangeReader = (head: Uint8Array, readRange: ReadRange, options: FlacRangeOptions) => {
  let remaining = boundedLimit(options.maxExtraReadBytes, MAX_COMMENT_BYTES + MAX_BLOCKS * 4 + 4);
  const offsetLimit = boundedLimit(options.maxMetadataOffsetBytes, MAX_METADATA_OFFSET);
  return async (position: number, length: number): Promise<Uint8Array> => {
    abortIfRequested(options.signal);
    if (position + length > offsetLimit) throw new Error('FLAC metadata offset budget exceeded');
    if (position + length <= head.length) return head.subarray(position, position + length);
    if (length > remaining) throw new Error('FLAC metadata read budget exceeded');
    remaining -= length;
    const bytes = await readRange(position, length);
    abortIfRequested(options.signal);
    if (bytes.length !== length) throw new Error('Truncated FLAC metadata range');
    return bytes;
  };
};

const readBlock = async (read: ReadRange, offset: number): Promise<MetadataBlock | undefined> => {
  const block = metadataBlock(await read(offset, 4), 0);
  return block ? { ...block, body: offset + block.body, end: offset + block.end } : undefined;
};

const readVorbisBlocks = async (read: ReadRange, offset: number): Promise<Id3Tags> => {
  for (let index = 1; index < MAX_BLOCKS; index += 1) {
    const block = await readBlock(read, offset);
    if (!block || block.type === 0) return {};
    if (block.type === 4) {
      if (block.length > MAX_COMMENT_BYTES) return {};
      return parseComment(await read(block.body, block.length));
    }
    if (block.last) return {};
    offset = block.end; // Jump past pictures/padding; their payload is not read.
  }
  return {};
};

export const parseFlacVorbisMetadataByRange = async (
  head: Uint8Array, readRange: ReadRange, options: FlacRangeOptions = {},
): Promise<Id3Tags> => {
  abortIfRequested(options.signal);
  const start = flacOffset(head);
  if (start === undefined || !startsWith(head, start, 'fLaC')) return {};
  try {
    const read = createRangeReader(head, readRange, options);
    if (!startsWith(await read(start, 4), 0, 'fLaC')) return {};
    const info = await readBlock(read, start + 4);
    if (!info || info.type !== 0 || info.length !== 34 || info.last) return {};
    return await readVorbisBlocks(read, info.end);
  } catch {
    abortIfRequested(options.signal);
    return {};
  }
};
