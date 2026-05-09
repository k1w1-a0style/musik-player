import type { Song } from '../types/Song';
import type { TagEditDraft, TagEditPlan, TagEditableContainer, TagWriterErrorCode, WriteOrchestrationResult } from '../types/TagEdit';
import { getTagEditCapability, getSupportedContainer } from './tagEditCapability';
import { normalizeEditableTags, validateCoverPayload, validateEditableTags } from './tagValidation';
import { createTagWriteOperationPlan, simulateTagWriteOperation } from './tagWriteOrchestrator';

export class TagWriterError extends Error {
  constructor(public code: TagWriterErrorCode, message: string) {
    super(message);
    this.name = 'TagWriterError';
  }
}

type ParsedId3Header = { major: 2 | 3 | 4; flags: number; size: number; totalTagBytes: number; frameStart: number; audioStart: number };
type ParsedFrame = { id: string; flags: [number, number]; body: Uint8Array };

const textEncoder = new TextEncoder();
const ID3_HEADER = 10;

export const hasId3Header = (buffer: Uint8Array): boolean => buffer.length >= 10 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33;
export const decodeSynchsafe = (sizeBytes: Uint8Array): number => {
  if (sizeBytes.length !== 4) throw new TagWriterError('InvalidTagData', 'Invalid synchsafe input size.');
  if (sizeBytes.some((b) => b > 0x7f)) throw new TagWriterError('InvalidTagData', 'Invalid synchsafe byte.');
  return (sizeBytes[0] << 21) | (sizeBytes[1] << 14) | (sizeBytes[2] << 7) | sizeBytes[3];
};
export const encodeSynchsafe = (size: number): Uint8Array => new Uint8Array([(size >> 21) & 0x7f, (size >> 14) & 0x7f, (size >> 7) & 0x7f, size & 0x7f]);

const readU32 = (b: Uint8Array, o: number): number => ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];

export const readId3Header = (buffer: Uint8Array): ParsedId3Header | undefined => {
  if (!hasId3Header(buffer)) return undefined;
  if (buffer.length < 10) throw new TagWriterError('InvalidTagData', 'Truncated ID3 header.');
  const major = buffer[3];
  if (major === 2) throw new TagWriterError('WriteNotImplemented', 'Existing ID3v2.2 tags are not supported yet.');
  if (major !== 2 && major !== 3 && major !== 4) throw new TagWriterError('InvalidTagData', `Unsupported ID3 major version: ${major}`);
  const flags = buffer[5];
  const size = decodeSynchsafe(buffer.subarray(6, 10));
  const footer = major === 4 && (flags & 0x10) !== 0 ? 10 : 0;
  const totalTagBytes = ID3_HEADER + size + footer;
  if (totalTagBytes > buffer.length) throw new TagWriterError('InvalidTagData', 'ID3 tag size exceeds buffer length.');
  let frameStart = ID3_HEADER;
  if ((flags & 0x40) !== 0) {
    if (major === 3) {
      if (frameStart + 4 > ID3_HEADER + size) throw new TagWriterError('InvalidTagData', 'Truncated ID3v2.3 extended header.');
      const ext = readU32(buffer, frameStart);
      if (ext < 6 || frameStart + 4 + ext > ID3_HEADER + size) throw new TagWriterError('InvalidTagData', 'Invalid ID3v2.3 extended header size.');
      frameStart += 4 + ext;
    } else if (major === 4) {
      if (frameStart + 4 > ID3_HEADER + size) throw new TagWriterError('InvalidTagData', 'Truncated ID3v2.4 extended header.');
      const ext = decodeSynchsafe(buffer.subarray(frameStart, frameStart + 4));
      if (ext < 6 || frameStart + ext > ID3_HEADER + size) throw new TagWriterError('InvalidTagData', 'Invalid ID3v2.4 extended header size.');
      frameStart += ext;
    }
  }
  return { major, flags, size, totalTagBytes, frameStart, audioStart: totalTagBytes };
};

const encodeUtf16Bom = (value: string): Uint8Array => {
  const out = new Uint8Array(2 + value.length * 4 + 2);
  out[0] = 0xff; out[1] = 0xfe;
  let p = 2;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    out[p++] = code & 0xff;
    out[p++] = (code >> 8) & 0xff;
  }
  out[p++] = 0; out[p++] = 0;
  return out.subarray(0, p);
};

const frame = (id: string, body: Uint8Array, flags: [number, number] = [0, 0]): Uint8Array => {
  const out = new Uint8Array(10 + body.length); out.set(textEncoder.encode(id), 0);
  out[4] = (body.length >>> 24) & 0xff; out[5] = (body.length >>> 16) & 0xff; out[6] = (body.length >>> 8) & 0xff; out[7] = body.length & 0xff; out[8] = flags[0]; out[9] = flags[1]; out.set(body, 10); return out;
};
const textFrame = (id: string, value: string): Uint8Array => frame(id, new Uint8Array([0x01, ...encodeUtf16Bom(value)]));
const commFrame = (value: string): Uint8Array => frame('COMM', new Uint8Array([0x01, 0x65, 0x6e, 0x67, 0x00, 0x00, ...encodeUtf16Bom(value)]));
const apicFrame = (mime: 'image/jpeg' | 'image/png', data: Uint8Array): Uint8Array => frame('APIC', new Uint8Array([0x00, ...textEncoder.encode(mime), 0x00, 0x03, 0x00, ...data]));

const parseFrames = (buffer: Uint8Array, h: ParsedId3Header): ParsedFrame[] => {
  if ((h.flags & 0x80) !== 0) throw new TagWriterError('WriteNotImplemented', 'Existing ID3 unsynchronisation is not supported yet.');
  const frames: ParsedFrame[] = []; const end = 10 + h.size; let p = h.frameStart;
  while (p + 10 <= end) {
    const id = String.fromCharCode(buffer[p], buffer[p + 1], buffer[p + 2], buffer[p + 3]);
    if (buffer[p] === 0) break;
    const sz = h.major === 4 ? decodeSynchsafe(buffer.subarray(p + 4, p + 8)) : readU32(buffer, p + 4);
    const flags: [number, number] = [buffer[p + 8], buffer[p + 9]];
    if (sz < 0 || p + 10 + sz > end) throw new TagWriterError('InvalidTagData', 'Truncated ID3 frame.');
    frames.push({ id, flags, body: buffer.slice(p + 10, p + 10 + sz) }); p += 10 + sz;
  }
  return frames;
};

const hasDraftTag = (draft: TagEditDraft, key: keyof TagEditDraft['tags']): boolean => Object.prototype.hasOwnProperty.call(draft.tags, key);

export const buildId3v23TagFromDraft = (draft: TagEditDraft, existing: ParsedFrame[] = []): Uint8Array => {
  const tags = normalizeEditableTags(draft.tags);
  const touchedFrameIds = new Set<string>();
  if (hasDraftTag(draft, 'title')) touchedFrameIds.add('TIT2');
  if (hasDraftTag(draft, 'artist')) touchedFrameIds.add('TPE1');
  if (hasDraftTag(draft, 'album')) touchedFrameIds.add('TALB');
  if (hasDraftTag(draft, 'year')) { touchedFrameIds.add('TYER'); touchedFrameIds.add('TDRC'); }
  if (hasDraftTag(draft, 'genre')) touchedFrameIds.add('TCON');
  if (hasDraftTag(draft, 'trackNumber')) touchedFrameIds.add('TRCK');
  if (hasDraftTag(draft, 'discNumber')) touchedFrameIds.add('TPOS');
  if (hasDraftTag(draft, 'comment')) touchedFrameIds.add('COMM');
  if (draft.removeCover || draft.cover) touchedFrameIds.add('APIC');

  const kept = existing.filter((f) => !touchedFrameIds.has(f.id));
  const replacement: Uint8Array[] = [];
  if (hasDraftTag(draft, 'title') && tags.title) replacement.push(textFrame('TIT2', tags.title));
  if (hasDraftTag(draft, 'artist') && tags.artist) replacement.push(textFrame('TPE1', tags.artist));
  if (hasDraftTag(draft, 'album') && tags.album) replacement.push(textFrame('TALB', tags.album));
  if (hasDraftTag(draft, 'year') && tags.year) replacement.push(textFrame('TYER', tags.year));
  if (hasDraftTag(draft, 'genre') && tags.genre) replacement.push(textFrame('TCON', tags.genre));
  if (hasDraftTag(draft, 'trackNumber') && tags.trackNumber) replacement.push(textFrame('TRCK', tags.trackNumber));
  if (hasDraftTag(draft, 'discNumber') && tags.discNumber) replacement.push(textFrame('TPOS', tags.discNumber));
  if (hasDraftTag(draft, 'comment') && tags.comment) replacement.push(commFrame(tags.comment));
  if (!draft.removeCover && draft.cover) replacement.push(apicFrame(draft.cover.mimeType, draft.cover.data));
  const keptFrames = kept.map((f) => frame(f.id, f.body, f.flags));
  const payloadLen = [...keptFrames, ...replacement].reduce((n, f) => n + f.length, 0);
  const out = new Uint8Array(10 + payloadLen); out.set([0x49, 0x44, 0x33, 0x03, 0x00, 0x00], 0); out.set(encodeSynchsafe(payloadLen), 6);
  let o = 10; for (const fr of [...keptFrames, ...replacement]) { out.set(fr, o); o += fr.length; }
  return out;
};

export const mergeId3v23TagIntoMp3Buffer = (original: Uint8Array, draft: TagEditDraft): Uint8Array => {
  if (original.length === 0) throw new TagWriterError('InvalidTagData', 'Empty audio buffer.');
  const header = readId3Header(original);
  const existing = header ? parseFrames(original, header) : [];
  const audio = header ? original.slice(header.audioStart) : original.slice();
  const tag = buildId3v23TagFromDraft(draft, existing);
  const out = new Uint8Array(tag.length + audio.length); out.set(tag, 0); out.set(audio, tag.length); return out;
};

export const prepareTagEditPlan = (song: Song, draft: TagEditDraft): TagEditPlan => createTagWriteOperationPlan(song, draft);
export const applyTagEditToBuffer = (buffer: Uint8Array, container: TagEditableContainer, draft: TagEditDraft): Uint8Array => {
  const normalized = { ...draft, cover: draft.removeCover ? undefined : draft.cover };
  const validation = validateEditableTags(normalized.tags);
  if (!validation.valid) throw new TagWriterError('InvalidTagData', validation.errors.join('; '));
  if (buffer.length === 0) throw new TagWriterError('InvalidTagData', 'Empty audio buffer.');
  if (!validateCoverPayload(normalized.cover)) throw new TagWriterError('InvalidTagData', 'Invalid cover payload.');
  if (container === 'unsupported') throw new TagWriterError('UnsupportedFormat', 'Container not supported.');
  if (container === 'm4a' || container === 'mp4') throw new TagWriterError('WriteNotImplemented', 'Container writer intentionally disabled in this PR.');
  if (container === 'mp3') return mergeId3v23TagIntoMp3Buffer(buffer, normalized);
  throw new TagWriterError('UnsupportedFormat', 'Unknown container.');
};

export const ensureTagEditWriteAllowed = (song: Song): void => { const capability = getTagEditCapability(song); const container = getSupportedContainer(song); if (container === 'unsupported') throw new TagWriterError('UnsupportedFormat', 'Container not supported for writing.'); if (!song.fileInfo?.uri && !song.uri) throw new TagWriterError('UnsupportedUri', 'Song has no editable URI.'); if (capability.uriType === 'remote' || capability.uriType === 'unknown') throw new TagWriterError('UnsupportedUri', capability.reason ?? 'URI is not writable.'); if (capability.uriType === 'file') throw new TagWriterError('WriteNotImplemented', 'Local file writes are intentionally disabled by policy in this PR.'); if (capability.uriType === 'content') throw new TagWriterError('MissingWritePermission', 'SAF write permission and safe write flow are required.'); };
export const prepareWriteOnly = (song: Song, draft: TagEditDraft): TagEditPlan => createTagWriteOperationPlan(song, draft);
export const dryRunWriteTags = (song: Song, draft: TagEditDraft): WriteOrchestrationResult => { const plan = createTagWriteOperationPlan(song, draft); return simulateTagWriteOperation(plan); };
export const writeTagsToFile = async (): Promise<never> => { throw new TagWriterError('WriteNotImplemented', 'Device file writes are intentionally disabled in this preparation step.'); };
