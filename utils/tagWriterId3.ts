import type { TagEditDraft } from '../types/TagEdit';
import { normalizeEditableTags } from './tagValidation';
import { readU32, textEncoder } from './tagWriterBytes';
import { hasAnyTagEditIntent, hasDraftTagIntent } from './tagWriterDraft';
import { TagWriterError } from './tagWriterError';

export type ParsedId3Header = {
  major: 2 | 3 | 4;
  flags: number;
  size: number;
  totalTagBytes: number;
  frameStart: number;
  audioStart: number;
};
export type ParsedFrame = { id: string; flags: [number, number]; body: Uint8Array };

type WritableId3Major = 3 | 4;
type Id3RewritePlan = { changed: boolean; tag?: Uint8Array };

const ID3_HEADER = 10;
const ID3_SYNCSAFE_MAX_SIZE = 0x0fffffff;
const ID3_V23_FRAME_SIZE_MAX = 0xffffffff;

const isValidId3FrameId = (id: string): boolean => /^[A-Z0-9]{4}$/.test(id);

export const startsWithId3Preamble = (buffer: Uint8Array): boolean =>
  buffer.length >= 3 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33;
export const hasCompleteId3Header = (buffer: Uint8Array): boolean =>
  buffer.length >= 10 && startsWithId3Preamble(buffer);
export const decodeSynchsafe = (sizeBytes: Uint8Array): number => {
  if (sizeBytes.length !== 4)
    throw new TagWriterError('InvalidTagData', 'Invalid synchsafe input size.');
  if (sizeBytes.some(b => b > 0x7f))
    throw new TagWriterError('InvalidTagData', 'Invalid synchsafe byte.');
  return (sizeBytes[0] << 21) | (sizeBytes[1] << 14) | (sizeBytes[2] << 7) | sizeBytes[3];
};
export const validateId3PayloadSize = (size: number): void => {
  if (
    !Number.isFinite(size) ||
    !Number.isInteger(size) ||
    size < 0 ||
    size > ID3_SYNCSAFE_MAX_SIZE
  ) {
    throw new TagWriterError('InvalidTagData', 'ID3 tag size exceeds synchsafe limit.');
  }
};

export const encodeSynchsafe = (size: number): Uint8Array => {
  validateId3PayloadSize(size);
  return new Uint8Array([
    (size >> 21) & 0x7f,
    (size >> 14) & 0x7f,
    (size >> 7) & 0x7f,
    size & 0x7f,
  ]);
};

export const readId3Header = (buffer: Uint8Array): ParsedId3Header | undefined => {
  const hasPreamble = startsWithId3Preamble(buffer);
  if (hasPreamble && buffer.length < 10)
    throw new TagWriterError('InvalidTagData', 'Truncated ID3 header.');
  if (!hasPreamble) return undefined;
  const major = buffer[3];
  if (major === 2)
    throw new TagWriterError(
      'WriteNotImplemented',
      'Existing ID3v2.2 tags are not supported yet.',
    );
  if (major !== 2 && major !== 3 && major !== 4)
    throw new TagWriterError('InvalidTagData', `Unsupported ID3 major version: ${major}`);
  const flags = buffer[5];
  const size = decodeSynchsafe(buffer.subarray(6, 10));
  const footer = major === 4 && (flags & 0x10) !== 0 ? 10 : 0;
  const totalTagBytes = ID3_HEADER + size + footer;
  if (totalTagBytes > buffer.length)
    throw new TagWriterError('InvalidTagData', 'ID3 tag size exceeds buffer length.');
  let frameStart = ID3_HEADER;
  if ((flags & 0x40) !== 0) {
    if (major === 3) {
      if (frameStart + 4 > ID3_HEADER + size)
        throw new TagWriterError('InvalidTagData', 'Truncated ID3v2.3 extended header.');
      const ext = readU32(buffer, frameStart);
      if (ext < 6 || frameStart + 4 + ext > ID3_HEADER + size)
        throw new TagWriterError(
          'InvalidTagData',
          'Invalid ID3v2.3 extended header size.',
        );
      frameStart += 4 + ext;
    } else if (major === 4) {
      if (frameStart + 4 > ID3_HEADER + size)
        throw new TagWriterError('InvalidTagData', 'Truncated ID3v2.4 extended header.');
      const ext = decodeSynchsafe(buffer.subarray(frameStart, frameStart + 4));
      if (ext < 6 || frameStart + ext > ID3_HEADER + size)
        throw new TagWriterError(
          'InvalidTagData',
          'Invalid ID3v2.4 extended header size.',
        );
      frameStart += ext;
    }
  }
  return { major, flags, size, totalTagBytes, frameStart, audioStart: totalTagBytes };
};

const encodeUtf16Bom = (value: string): Uint8Array => {
  const out = new Uint8Array(2 + value.length * 4 + 2);
  out[0] = 0xff;
  out[1] = 0xfe;
  let p = 2;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    out[p++] = code & 0xff;
    out[p++] = (code >> 8) & 0xff;
  }
  out[p++] = 0;
  out[p++] = 0;
  return out.subarray(0, p);
};

const frame = (
  id: string,
  body: Uint8Array,
  flags: [number, number] = [0, 0],
  major: WritableId3Major = 3,
): Uint8Array => {
  if (!isValidId3FrameId(id))
    throw new TagWriterError('InvalidTagData', 'Invalid ID3 frame ID.');
  if (!Number.isInteger(body.length) || body.length < 0)
    throw new TagWriterError('InvalidTagData', 'Invalid ID3 frame size.');
  if (major === 4) {
    validateId3PayloadSize(body.length);
  } else if (body.length > ID3_V23_FRAME_SIZE_MAX) {
    throw new TagWriterError('InvalidTagData', 'Invalid ID3 frame size.');
  }

  const out = new Uint8Array(10 + body.length);
  out.set(textEncoder.encode(id), 0);
  if (major === 4) {
    out.set(encodeSynchsafe(body.length), 4);
  } else {
    out[4] = (body.length >>> 24) & 0xff;
    out[5] = (body.length >>> 16) & 0xff;
    out[6] = (body.length >>> 8) & 0xff;
    out[7] = body.length & 0xff;
  }
  out[8] = flags[0];
  out[9] = flags[1];
  out.set(body, 10);
  return out;
};

const textFrame = (id: string, value: string, major: WritableId3Major): Uint8Array => {
  const textBytes = encodeUtf16Bom(value);
  const body = new Uint8Array(1 + textBytes.length);
  body[0] = 0x01;
  body.set(textBytes, 1);
  return frame(id, body, [0, 0], major);
};

const commFrame = (value: string, major: WritableId3Major): Uint8Array => {
  const textBytes = encodeUtf16Bom(value);
  const descriptorBytes = encodeUtf16Bom('');
  const body = new Uint8Array(1 + 3 + descriptorBytes.length + textBytes.length);
  let offset = 0;
  body[offset++] = 0x01;
  body[offset++] = 0x65;
  body[offset++] = 0x6e;
  body[offset++] = 0x67;
  body.set(descriptorBytes, offset);
  offset += descriptorBytes.length;
  body.set(textBytes, offset);
  return frame('COMM', body, [0, 0], major);
};

const apicFrame = (
  mime: 'image/jpeg' | 'image/png',
  data: Uint8Array,
  major: WritableId3Major,
): Uint8Array => {
  const mimeBytes = textEncoder.encode(mime);
  const body = new Uint8Array(1 + mimeBytes.length + 1 + 1 + 1 + data.length);
  let offset = 0;
  body[offset++] = 0x00;
  body.set(mimeBytes, offset);
  offset += mimeBytes.length;
  body[offset++] = 0x00;
  body[offset++] = 0x03;
  body[offset++] = 0x00;
  body.set(data, offset);
  return frame('APIC', body, [0, 0], major);
};

const parseFrames = (buffer: Uint8Array, h: ParsedId3Header): ParsedFrame[] => {
  if ((h.flags & 0x80) !== 0)
    throw new TagWriterError(
      'WriteNotImplemented',
      'Existing ID3 unsynchronisation is not supported yet.',
    );
  if (h.major === 4 && (h.flags & 0x40) !== 0)
    throw new TagWriterError(
      'WriteNotImplemented',
      'Existing ID3v2.4 extended headers are not supported for safe rewriting yet.',
    );
  if (h.major === 4 && (h.flags & 0x20) !== 0)
    throw new TagWriterError(
      'WriteNotImplemented',
      'Existing experimental ID3v2.4 tags are not supported for safe rewriting yet.',
    );
  if (h.major === 4 && (h.flags & 0x10) !== 0)
    throw new TagWriterError(
      'WriteNotImplemented',
      'Existing ID3v2.4 footer tags are not supported yet.',
    );

  const frames: ParsedFrame[] = [];
  const end = 10 + h.size;
  let p = h.frameStart;
  while (p + 10 <= end) {
    const id = String.fromCharCode(
      buffer[p],
      buffer[p + 1],
      buffer[p + 2],
      buffer[p + 3],
    );
    if (buffer[p] === 0) break;
    if (!isValidId3FrameId(id))
      throw new TagWriterError('InvalidTagData', 'Invalid ID3 frame ID.');
    const sz =
      h.major === 4
        ? decodeSynchsafe(buffer.subarray(p + 4, p + 8))
        : readU32(buffer, p + 4);
    const rawFlags: [number, number] = [buffer[p + 8], buffer[p + 9]];
    if (h.major === 4 && (rawFlags[0] !== 0 || rawFlags[1] !== 0)) {
      throw new TagWriterError(
        'WriteNotImplemented',
        'ID3v2.4 frame flags requiring compression, encryption, unsynchronisation, grouping, data-length indicators, or preservation semantics are not supported yet.',
      );
    }
    const flags: [number, number] = h.major === 4 ? [0, 0] : rawFlags;
    if (sz < 0 || p + 10 + sz > end)
      throw new TagWriterError('InvalidTagData', 'Truncated ID3 frame.');
    frames.push({ id, flags, body: buffer.slice(p + 10, p + 10 + sz) });
    p += 10 + sz;
  }
  return frames;
};

const getTouchedFrameIds = (draft: TagEditDraft): Set<string> => {
  const touched = new Set<string>();
  const mappings: Array<[keyof TagEditDraft['tags'], string]> = [
    ['title', 'TIT2'],
    ['artist', 'TPE1'],
    ['albumArtist', 'TPE2'],
    ['album', 'TALB'],
    ['genre', 'TCON'],
    ['trackNumber', 'TRCK'],
    ['discNumber', 'TPOS'],
    ['comment', 'COMM'],
  ];
  for (const [key, frameId] of mappings) {
    if (hasDraftTagIntent(draft, key)) touched.add(frameId);
  }
  if (hasDraftTagIntent(draft, 'year')) {
    touched.add('TYER');
    touched.add('TDRC');
  }
  if (draft.removeCover || draft.cover) touched.add('APIC');
  return touched;
};

const buildReplacementFrames = (
  draft: TagEditDraft,
  tags: ReturnType<typeof normalizeEditableTags>,
  major: WritableId3Major,
): Uint8Array[] => {
  const replacements: Uint8Array[] = [];
  const leadingTextMappings: Array<[keyof TagEditDraft['tags'], string]> = [
    ['title', 'TIT2'],
    ['artist', 'TPE1'],
    ['albumArtist', 'TPE2'],
    ['album', 'TALB'],
  ];
  for (const [key, frameId] of leadingTextMappings) {
    const value = tags[key];
    if (hasDraftTagIntent(draft, key) && value) replacements.push(textFrame(frameId, value, major));
  }
  if (hasDraftTagIntent(draft, 'year') && tags.year) {
    replacements.push(textFrame(major === 4 ? 'TDRC' : 'TYER', tags.year, major));
    if (major === 3) replacements.push(textFrame('TDRC', tags.year, major));
  }
  const trailingTextMappings: Array<[keyof TagEditDraft['tags'], string]> = [
    ['genre', 'TCON'],
    ['trackNumber', 'TRCK'],
    ['discNumber', 'TPOS'],
  ];
  for (const [key, frameId] of trailingTextMappings) {
    const value = tags[key];
    if (hasDraftTagIntent(draft, key) && value) replacements.push(textFrame(frameId, value, major));
  }
  if (hasDraftTagIntent(draft, 'comment') && tags.comment) {
    replacements.push(commFrame(tags.comment, major));
  }
  if (!draft.removeCover && draft.cover) {
    replacements.push(apicFrame(draft.cover.mimeType, draft.cover.data, major));
  }
  return replacements;
};

const encodeId3Tag = (frames: Uint8Array[], major: WritableId3Major): Uint8Array => {
  const payloadLength = frames.reduce((total, encodedFrame) => total + encodedFrame.length, 0);
  if (payloadLength === 0) return new Uint8Array(0);
  validateId3PayloadSize(payloadLength);
  const output = new Uint8Array(ID3_HEADER + payloadLength);
  output.set([0x49, 0x44, 0x33, major, 0x00, 0x00], 0);
  output.set(encodeSynchsafe(payloadLength), 6);
  let offset = ID3_HEADER;
  for (const encodedFrame of frames) {
    output.set(encodedFrame, offset);
    offset += encodedFrame.length;
  }
  return output;
};

const buildId3TagFromDraft = (
  draft: TagEditDraft,
  existing: ParsedFrame[],
  major: WritableId3Major,
): Id3RewritePlan => {
  const tags = normalizeEditableTags(draft.tags);
  const touchedFrameIds = getTouchedFrameIds(draft);
  const existingTouched = existing.some(existingFrame => touchedFrameIds.has(existingFrame.id));
  const keptFrames = existing
    .filter(existingFrame => !touchedFrameIds.has(existingFrame.id))
    .map(existingFrame => frame(existingFrame.id, existingFrame.body, existingFrame.flags, major));
  const replacementFrames = buildReplacementFrames(draft, tags, major);
  if (!existingTouched && replacementFrames.length === 0) return { changed: false };
  return { changed: true, tag: encodeId3Tag([...keptFrames, ...replacementFrames], major) };
};

export const buildId3v23TagFromDraft = (
  draft: TagEditDraft,
  existing: ParsedFrame[] = [],
): Id3RewritePlan => buildId3TagFromDraft(draft, existing, 3);

export const mergeId3v23TagIntoMp3Buffer = (
  original: Uint8Array,
  draft: TagEditDraft,
): Uint8Array => {
  if (original.length === 0)
    throw new TagWriterError('InvalidTagData', 'Empty audio buffer.');
  const header = readId3Header(original);
  if (header?.major === 4 && !hasAnyTagEditIntent(draft)) return original.slice();
  const existing = header ? parseFrames(original, header) : [];
  const audio = header ? original.slice(header.audioStart) : original.slice();
  const targetMajor: WritableId3Major = header?.major === 4 ? 4 : 3;
  const rewrite = buildId3TagFromDraft(draft, existing, targetMajor);
  if (!rewrite.changed) return original.slice();
  const tag = rewrite.tag ?? new Uint8Array(0);
  const out = new Uint8Array(tag.length + audio.length);
  out.set(tag, 0);
  out.set(audio, tag.length);
  return out;
};
