import type { Song } from '../types/Song';
import type { EditableTrackTags, TagEditDraft, TagEditPlan, TagEditableContainer, TagWriterErrorCode } from '../types/TagEdit';
import { getTagEditCapability, getUriType, getSupportedContainer } from './tagEditCapability';
import { normalizeEditableTags, validateCoverPayload, validateEditableTags } from './tagValidation';

export class TagWriterError extends Error {
  constructor(public code: TagWriterErrorCode, message: string) {
    super(message);
    this.name = 'TagWriterError';
  }
}

const ID3_TEXT_FRAME_IDS = ['TIT2', 'TPE1', 'TALB', 'TDRC', 'TCON', 'TRCK', 'TPOS'] as const;
type Id3TextFrameId = (typeof ID3_TEXT_FRAME_IDS)[number];

export const ID3_TEXT_FRAME_MAP: Partial<Record<keyof EditableTrackTags, Id3TextFrameId>> = {
  title: 'TIT2',
  artist: 'TPE1',
  album: 'TALB',
  year: 'TDRC',
  genre: 'TCON',
  trackNumber: 'TRCK',
  discNumber: 'TPOS',
};

const encodeLatin1 = (value: string): Uint8Array => Uint8Array.from([...value].map(c => c.charCodeAt(0) & 0xff));
const u32be = (n: number): Uint8Array => new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);

const isValidId3TextFrameId = (id: string): id is Id3TextFrameId => ID3_TEXT_FRAME_IDS.includes(id as Id3TextFrameId);

const encodeAscii = (value: string): Uint8Array => Uint8Array.from([...value].map(c => c.charCodeAt(0) & 0x7f));

export const serializeId3CommentFrame = (comment: string): Uint8Array => {
  const value = comment.trim();
  if (!value) throw new TagWriterError('InvalidTagData', 'Comment must not be empty.');
  // encoding(0x00) + lang("eng") + desc("" + null) + text
  const body = new Uint8Array(1 + 3 + 1 + value.length);
  body[0] = 0x00;
  body.set(encodeAscii('eng'), 1);
  body[4] = 0x00;
  body.set(encodeLatin1(value), 5);
  const out = new Uint8Array(10 + body.length);
  out.set(encodeAscii('COMM'), 0);
  out.set(u32be(body.length), 4);
  out[8] = 0;
  out[9] = 0;
  out.set(body, 10);
  return out;
};

export const serializeId3ApicFrame = (mimeType: 'image/jpeg' | 'image/png', data: Uint8Array): Uint8Array => {
  if (data.length === 0) throw new TagWriterError('InvalidTagData', 'Cover image bytes are empty.');
  const mime = encodeAscii(mimeType);
  // encoding + mime + null + picture type + description null + image data
  const body = new Uint8Array(1 + mime.length + 1 + 1 + 1 + data.length);
  let off = 0;
  body[off++] = 0x00;
  body.set(mime, off); off += mime.length;
  body[off++] = 0x00;
  body[off++] = 0x03;
  body[off++] = 0x00;
  body.set(data, off);
  const out = new Uint8Array(10 + body.length);
  out.set(encodeAscii('APIC'), 0);
  out.set(u32be(body.length), 4);
  out[8] = 0;
  out[9] = 0;
  out.set(body, 10);
  return out;
};


export const serializeId3TextFrame = (id: string, value: string): Uint8Array => {
  if (!isValidId3TextFrameId(id)) throw new TagWriterError('InvalidTagData', `Unsupported ID3 text frame id: ${id}`);
  const normalizedValue = value.trim();
  if (!normalizedValue) throw new TagWriterError('InvalidTagData', 'ID3 text frame value must not be empty.');

  const payload = new Uint8Array(1 + normalizedValue.length);
  payload[0] = 0x00;
  payload.set(encodeLatin1(normalizedValue), 1);
  const out = new Uint8Array(10 + payload.length);
  out.set(encodeLatin1(id), 0);
  out.set(u32be(payload.length), 4);
  out[8] = 0;
  out[9] = 0;
  out.set(payload, 10);
  return out;
};

export const buildMp3TextFrames = (tags: EditableTrackTags): Uint8Array[] => {
  const normalized = normalizeEditableTags(tags);
  return Object.entries(ID3_TEXT_FRAME_MAP)
    .flatMap(([key, frameId]) => {
      const value = normalized[key as keyof EditableTrackTags];
      if (!frameId || !value) return [];
      return [serializeId3TextFrame(frameId, value)];
    });
};


const toSynchsafe = (size: number): Uint8Array => new Uint8Array([
  (size >> 21) & 0x7f,
  (size >> 14) & 0x7f,
  (size >> 7) & 0x7f,
  size & 0x7f,
]);


const readU32 = (bytes: Uint8Array, off: number): number => (
  ((bytes[off] << 24) >>> 0) + (bytes[off + 1] << 16) + (bytes[off + 2] << 8) + bytes[off + 3]
);

const extractId3v23Frames = (tagBytes: Uint8Array): Array<{ id: string; raw: Uint8Array }> => {
  const frames: Array<{ id: string; raw: Uint8Array }> = [];
  if (!hasId3Header(tagBytes) || tagBytes.length < 10) return frames;
  let off = 10;
  while (off + 10 <= tagBytes.length) {
    const id = String.fromCharCode(tagBytes[off], tagBytes[off + 1], tagBytes[off + 2], tagBytes[off + 3]);
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const frameSize = readU32(tagBytes, off + 4);
    const total = 10 + frameSize;
    if (frameSize <= 0 || off + total > tagBytes.length) break;
    frames.push({ id, raw: tagBytes.subarray(off, off + total) });
    off += total;
  }
  return frames;
};

const buildId3v23TagFromFrames = (frames: Uint8Array[]): Uint8Array => {
  const payloadSize = frames.reduce((sum, f) => sum + f.length, 0);
  const out = new Uint8Array(10 + payloadSize);
  out[0] = 0x49; out[1] = 0x44; out[2] = 0x33;
  out[3] = 0x03; out[4] = 0x00; out[5] = 0x00;
  out.set(toSynchsafe(payloadSize), 6);
  let off = 10;
  for (const frame of frames) {
    out.set(frame, off);
    off += frame.length;
  }
  return out;
};

export const buildId3v23TagFromDraft = (draft: TagEditDraft): Uint8Array => {
  const validation = validateEditableTags(draft.tags);
  if (!validation.valid) throw new TagWriterError('InvalidTagData', validation.errors.join('; '));
  if (!validateCoverPayload(draft.cover)) throw new TagWriterError('InvalidTagData', 'Invalid cover payload.');

  const frames = buildMp3TextFrames(draft.tags);
  if (draft.tags.comment) frames.push(serializeId3CommentFrame(draft.tags.comment));
  if (!draft.removeCover && draft.cover) frames.push(serializeId3ApicFrame(draft.cover.mimeType, draft.cover.data));
  return buildId3v23TagFromFrames(frames);
};


const decodeSynchsafe = (bytes: Uint8Array, off: number): number => (
  (bytes[off] << 21) | (bytes[off + 1] << 14) | (bytes[off + 2] << 7) | bytes[off + 3]
);

const hasId3Header = (bytes: Uint8Array): boolean => (
  bytes.length >= 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33
);

export const mergeId3v23TagIntoMp3Buffer = (original: Uint8Array, draft: TagEditDraft): Uint8Array => {
  if (original.length === 0) throw new TagWriterError('InvalidTagData', 'Empty MP3 buffer.');
  const draftTag = buildId3v23TagFromDraft(draft);

  if (!hasId3Header(original)) {
    const merged = new Uint8Array(draftTag.length + original.length);
    merged.set(draftTag, 0);
    merged.set(original, draftTag.length);
    return merged;
  }

  const currentTagSize = decodeSynchsafe(original, 6);
  const currentTagTotal = 10 + currentTagSize;
  if (currentTagTotal > original.length) {
    throw new TagWriterError('InvalidTagData', 'Existing ID3 tag is truncated.');
  }

  const existingTag = original.subarray(0, currentTagTotal);
  const newFrames = extractId3v23Frames(draftTag);
  const newIds = new Set(newFrames.map(f => f.id));
  const preservedFrames = extractId3v23Frames(existingTag)
    .filter(frame => !newIds.has(frame.id))
    .map(frame => frame.raw);

  const rebuiltTag = buildId3v23TagFromFrames([
    ...newFrames.map(frame => frame.raw),
    ...preservedFrames,
  ]);

  const audioPart = original.subarray(currentTagTotal);
  const merged = new Uint8Array(rebuiltTag.length + audioPart.length);
  merged.set(rebuiltTag, 0);
  merged.set(audioPart, rebuiltTag.length);
  return merged;
};

export const prepareTagEditPlan = (song: Song, draft: TagEditDraft): TagEditPlan => {
  const uri = song.fileInfo?.uri ?? song.uri;
  if (!uri) throw new TagWriterError('UnsupportedUri', 'Song has no editable URI.');
  const capability = getTagEditCapability(song);
  const container = getSupportedContainer(song);

  if (capability.uriType === 'unknown') throw new TagWriterError('UnsupportedUri', 'Unsupported URI type for editing.');

  const warnings = [...(capability.reason ? [capability.reason] : [])];
  if (draft.removeCover && draft.cover) warnings.push('removeCover=true takes precedence over cover payload.');
  if (container === 'm4a' || container === 'mp4') warnings.push('MP4/M4A writing intentionally blocked until safe atom rewrite is implemented.');

  return {
    uri,
    uriType: getUriType(uri),
    container,
    requiresBackup: true,
    requiresFullRewrite: container !== 'unsupported',
    estimatedRisk: capability.uriType === 'file' ? 'medium' : 'high',
    warnings,
  };
};

export const applyTagEditToBuffer = (buffer: Uint8Array, container: TagEditableContainer, draft: TagEditDraft): Uint8Array => {
  const validation = validateEditableTags(draft.tags);
  if (!validation.valid) throw new TagWriterError('InvalidTagData', validation.errors.join('; '));
  if (!validateCoverPayload(draft.cover)) throw new TagWriterError('InvalidTagData', 'Invalid cover payload.');
  if (container === 'unsupported') throw new TagWriterError('UnsupportedFormat', 'Container not supported.');
  if (container === 'm4a' || container === 'mp4') throw new TagWriterError('WriteNotImplemented', 'MP4/M4A writing not implemented safely yet.');
  if (container === 'mp3') {
    if (buffer.length === 0) throw new TagWriterError('InvalidTagData', 'Empty buffer.');
    return mergeId3v23TagIntoMp3Buffer(buffer, draft);
  }
  throw new TagWriterError('UnsupportedFormat', 'Unknown container.');
};


export const ensureTagEditWriteAllowed = (song: Song): void => {
  const capability = getTagEditCapability(song);
  if (!capability.canWrite) {
    if (capability.uriType === 'content' || capability.uriType === 'file') {
      throw new TagWriterError('MissingWritePermission', capability.reason ?? 'Write permission missing.');
    }
    throw new TagWriterError('UnsupportedUri', capability.reason ?? 'URI is not writable.');
  }
};

export const writeTagsToFile = async (): Promise<never> => {
  throw new TagWriterError('WriteNotImplemented', 'Device file writes are intentionally disabled in this preparation step.');
};
