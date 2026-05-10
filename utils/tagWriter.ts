import type { Song } from '../types/Song';
import type { TagEditDraft, TagEditPlan, TagEditableContainer, TagWriterErrorCode, WriteOrchestrationResult, WriteTagsResult } from '../types/TagEdit';
import { getTagEditCapability, getSupportedContainer } from './tagEditCapability';
import { normalizeEditableTags, validateCoverPayload, validateEditableTags } from './tagValidation';
import { createTagWriteOperationPlan, simulateTagWriteOperation } from './tagWriteOrchestrator';
import { expoTagFileWriteAdapter, type TagFileWriteAdapter } from './tagFileWriteAdapter';

export class TagWriterError extends Error {
  constructor(public code: TagWriterErrorCode, message: string) {
    super(message);
    this.name = 'TagWriterError';
  }
}

type ParsedId3Header = { major: 2 | 3 | 4; flags: number; size: number; totalTagBytes: number; frameStart: number; audioStart: number };
type ParsedFrame = { id: string; flags: [number, number]; body: Uint8Array };
type ParsedMp4Atom = { start: number; end: number; headerSize: number; size: number; type: string; typeBytes: Uint8Array; payloadStart: number };

const textEncoder = new TextEncoder();
const ID3_HEADER = 10;
const ID3_SYNCSAFE_MAX_SIZE = 0x0fffffff;
const ID3_V23_FRAME_SIZE_MAX = 0xffffffff;

const isValidId3v23FrameId = (id: string): boolean => /^[A-Z0-9]{4}$/.test(id);

export const startsWithId3Preamble = (buffer: Uint8Array): boolean => buffer.length >= 3 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33;
export const hasCompleteId3Header = (buffer: Uint8Array): boolean => buffer.length >= 10 && startsWithId3Preamble(buffer);
export const hasId3Header = hasCompleteId3Header;
export const decodeSynchsafe = (sizeBytes: Uint8Array): number => {
  if (sizeBytes.length !== 4) throw new TagWriterError('InvalidTagData', 'Invalid synchsafe input size.');
  if (sizeBytes.some((b) => b > 0x7f)) throw new TagWriterError('InvalidTagData', 'Invalid synchsafe byte.');
  return (sizeBytes[0] << 21) | (sizeBytes[1] << 14) | (sizeBytes[2] << 7) | sizeBytes[3];
};
export const validateId3PayloadSize = (size: number): void => {
  if (!Number.isFinite(size) || !Number.isInteger(size) || size < 0 || size > ID3_SYNCSAFE_MAX_SIZE) {
    throw new TagWriterError('InvalidTagData', 'ID3 tag size exceeds synchsafe limit.');
  }
};

export const encodeSynchsafe = (size: number): Uint8Array => {
  validateId3PayloadSize(size);
  return new Uint8Array([(size >> 21) & 0x7f, (size >> 14) & 0x7f, (size >> 7) & 0x7f, size & 0x7f]);
};

const readU32 = (b: Uint8Array, o: number): number => ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
const writeU32 = (b: Uint8Array, o: number, value: number): void => { b[o] = (value >>> 24) & 0xff; b[o + 1] = (value >>> 16) & 0xff; b[o + 2] = (value >>> 8) & 0xff; b[o + 3] = value & 0xff; };
const atomType = (...bytes: number[]): Uint8Array => new Uint8Array(bytes);
const MP4_TYPES = {
  moov: atomType(0x6d, 0x6f, 0x6f, 0x76), mdat: atomType(0x6d, 0x64, 0x61, 0x74), udta: atomType(0x75, 0x64, 0x74, 0x61),
  meta: atomType(0x6d, 0x65, 0x74, 0x61), ilst: atomType(0x69, 0x6c, 0x73, 0x74), data: atomType(0x64, 0x61, 0x74, 0x61),
  trkn: atomType(0x74, 0x72, 0x6b, 0x6e), disk: atomType(0x64, 0x69, 0x73, 0x6b), covr: atomType(0x63, 0x6f, 0x76, 0x72),
  cnam: atomType(0xa9, 0x6e, 0x61, 0x6d), cART: atomType(0xa9, 0x41, 0x52, 0x54), calb: atomType(0xa9, 0x61, 0x6c, 0x62),
  cday: atomType(0xa9, 0x64, 0x61, 0x79), cgen: atomType(0xa9, 0x67, 0x65, 0x6e), ccmt: atomType(0xa9, 0x63, 0x6d, 0x74),
};
const atomKey = (bytes: Uint8Array): string => String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
const sameType = (bytes: Uint8Array, target: Uint8Array): boolean => bytes.length === 4 && bytes.every((b, i) => b === target[i]);
const parseAtoms = (buffer: Uint8Array, start: number, end: number, allowSizeZero = false): ParsedMp4Atom[] => {
  const atoms: ParsedMp4Atom[] = []; let p = start;
  while (p < end) {
    if (p + 8 > end) throw new TagWriterError('InvalidTagData', 'Truncated MP4 atom header.');
    const size32 = readU32(buffer, p); const typeBytes = buffer.slice(p + 4, p + 8); const type = atomKey(typeBytes);
    if (size32 === 1) throw new TagWriterError('WriteNotImplemented', 'MP4 largesize atoms are not supported yet.');
    let size = size32;
    if (size32 === 0) { if (!allowSizeZero) throw new TagWriterError('InvalidTagData', 'Nested MP4 atom with size 0 is invalid.'); size = end - p; }
    if (size < 8) throw new TagWriterError('InvalidTagData', `Invalid MP4 atom size for ${type}.`);
    const atomEnd = p + size; if (atomEnd > end) throw new TagWriterError('InvalidTagData', `MP4 atom exceeds buffer for ${type}.`);
    atoms.push({ start: p, end: atomEnd, headerSize: 8, size, type, typeBytes, payloadStart: p + 8 }); p = atomEnd;
  }
  return atoms;
};
const rebuildAtom = (typeBytes: Uint8Array, payload: Uint8Array): Uint8Array => {
  const out = new Uint8Array(8 + payload.length); writeU32(out, 0, out.length); out.set(typeBytes, 4); out.set(payload, 8); return out;
};
const buildDataAtom = (dataType: number, payload: Uint8Array): Uint8Array => {
  const body = new Uint8Array(8 + payload.length); writeU32(body, 0, dataType); writeU32(body, 4, 0); body.set(payload, 8); return rebuildAtom(MP4_TYPES.data, body);
};
const parsePacked = (value: string): [number, number] => {
  const m = value.trim().match(/^(\d+)(?:\/(\d+))?$/); if (!m) throw new TagWriterError('InvalidTagData', 'Invalid packed track/disc format.');
  return [Number(m[1]), Number(m[2] ?? 0)];
};
const buildPackedNumberAtom = (type: Uint8Array, value: string): Uint8Array => {
  const [current, total] = parsePacked(value); const payload = new Uint8Array(8); payload[2] = (current >>> 8) & 0xff; payload[3] = current & 0xff; payload[4] = (total >>> 8) & 0xff; payload[5] = total & 0xff;
  return rebuildAtom(type, buildDataAtom(0, payload));
};
const concatBytes = (parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

export const readId3Header = (buffer: Uint8Array): ParsedId3Header | undefined => {
  const hasPreamble = startsWithId3Preamble(buffer);
  if (hasPreamble && buffer.length < 10) throw new TagWriterError('InvalidTagData', 'Truncated ID3 header.');
  if (!hasPreamble) return undefined;
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
  if (!isValidId3v23FrameId(id)) throw new TagWriterError('InvalidTagData', 'Invalid ID3 frame ID.');
  if (!Number.isInteger(body.length) || body.length < 0 || body.length > ID3_V23_FRAME_SIZE_MAX) throw new TagWriterError('InvalidTagData', 'Invalid ID3 frame size.');
  const out = new Uint8Array(10 + body.length); out.set(textEncoder.encode(id), 0);
  out[4] = (body.length >>> 24) & 0xff; out[5] = (body.length >>> 16) & 0xff; out[6] = (body.length >>> 8) & 0xff; out[7] = body.length & 0xff; out[8] = flags[0]; out[9] = flags[1]; out.set(body, 10); return out;
};
const textFrame = (id: string, value: string): Uint8Array => {
  const textBytes = encodeUtf16Bom(value);
  const body = new Uint8Array(1 + textBytes.length);
  body[0] = 0x01;
  body.set(textBytes, 1);
  return frame(id, body);
};
const commFrame = (value: string): Uint8Array => {
  const textBytes = encodeUtf16Bom(value);
  const body = new Uint8Array(1 + 3 + 2 + textBytes.length);
  let offset = 0;
  body[offset++] = 0x01;
  body[offset++] = 0x65;
  body[offset++] = 0x6e;
  body[offset++] = 0x67;
  body[offset++] = 0x00;
  body[offset++] = 0x00;
  body.set(textBytes, offset);
  return frame('COMM', body);
};
const apicFrame = (mime: 'image/jpeg' | 'image/png', data: Uint8Array): Uint8Array => {
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
  return frame('APIC', body);
};

const parseFrames = (buffer: Uint8Array, h: ParsedId3Header): ParsedFrame[] => {
  if ((h.flags & 0x80) !== 0) throw new TagWriterError('WriteNotImplemented', 'Existing ID3 unsynchronisation is not supported yet.');
  const frames: ParsedFrame[] = []; const end = 10 + h.size; let p = h.frameStart;
  while (p + 10 <= end) {
    const id = String.fromCharCode(buffer[p], buffer[p + 1], buffer[p + 2], buffer[p + 3]);
    if (buffer[p] === 0) break;
    if (!isValidId3v23FrameId(id)) throw new TagWriterError('InvalidTagData', 'Invalid ID3 frame ID.');
    const sz = h.major === 4 ? decodeSynchsafe(buffer.subarray(p + 4, p + 8)) : readU32(buffer, p + 4);
    const flags: [number, number] = [buffer[p + 8], buffer[p + 9]];
    if (sz < 0 || p + 10 + sz > end) throw new TagWriterError('InvalidTagData', 'Truncated ID3 frame.');
    frames.push({ id, flags, body: buffer.slice(p + 10, p + 10 + sz) }); p += 10 + sz;
  }
  return frames;
};

const hasDraftTagIntent = (draft: TagEditDraft, key: keyof TagEditDraft['tags']): boolean => Object.prototype.hasOwnProperty.call(draft.tags, key) && draft.tags[key] !== undefined;
const hasAnyTagEditIntent = (draft: TagEditDraft): boolean => {
  const keys: Array<keyof TagEditDraft['tags']> = ['title', 'artist', 'album', 'year', 'genre', 'trackNumber', 'discNumber', 'comment'];
  const hasTagIntent = keys.some((key) => hasDraftTagIntent(draft, key));
  return hasTagIntent || Boolean(draft.cover) || draft.removeCover === true;
};

type Id3RewritePlan = { changed: boolean; tag?: Uint8Array };

export const buildId3v23TagFromDraft = (draft: TagEditDraft, existing: ParsedFrame[] = []): Id3RewritePlan => {
  const tags = normalizeEditableTags(draft.tags);
  const touchedFrameIds = new Set<string>();
  if (hasDraftTagIntent(draft, 'title')) touchedFrameIds.add('TIT2');
  if (hasDraftTagIntent(draft, 'artist')) touchedFrameIds.add('TPE1');
  if (hasDraftTagIntent(draft, 'album')) touchedFrameIds.add('TALB');
  if (hasDraftTagIntent(draft, 'year')) { touchedFrameIds.add('TYER'); touchedFrameIds.add('TDRC'); }
  if (hasDraftTagIntent(draft, 'genre')) touchedFrameIds.add('TCON');
  if (hasDraftTagIntent(draft, 'trackNumber')) touchedFrameIds.add('TRCK');
  if (hasDraftTagIntent(draft, 'discNumber')) touchedFrameIds.add('TPOS');
  if (hasDraftTagIntent(draft, 'comment')) touchedFrameIds.add('COMM');
  if (draft.removeCover || draft.cover) touchedFrameIds.add('APIC');

  const existingTouched = existing.some((f) => touchedFrameIds.has(f.id));
  const kept = existing.filter((f) => !touchedFrameIds.has(f.id));
  const replacement: Uint8Array[] = [];
  if (hasDraftTagIntent(draft, 'title') && tags.title) replacement.push(textFrame('TIT2', tags.title));
  if (hasDraftTagIntent(draft, 'artist') && tags.artist) replacement.push(textFrame('TPE1', tags.artist));
  if (hasDraftTagIntent(draft, 'album') && tags.album) replacement.push(textFrame('TALB', tags.album));
  if (hasDraftTagIntent(draft, 'year') && tags.year) replacement.push(textFrame('TYER', tags.year));
  if (hasDraftTagIntent(draft, 'genre') && tags.genre) replacement.push(textFrame('TCON', tags.genre));
  if (hasDraftTagIntent(draft, 'trackNumber') && tags.trackNumber) replacement.push(textFrame('TRCK', tags.trackNumber));
  if (hasDraftTagIntent(draft, 'discNumber') && tags.discNumber) replacement.push(textFrame('TPOS', tags.discNumber));
  if (hasDraftTagIntent(draft, 'comment') && tags.comment) replacement.push(commFrame(tags.comment));
  if (!draft.removeCover && draft.cover) replacement.push(apicFrame(draft.cover.mimeType, draft.cover.data));

  const changed = existingTouched || replacement.length > 0;
  if (!changed) return { changed: false };

  const keptFrames = kept.map((f) => frame(f.id, f.body, f.flags));
  const payloadLen = [...keptFrames, ...replacement].reduce((n, f) => n + f.length, 0);
  if (payloadLen === 0) return { changed: true, tag: new Uint8Array(0) };
  validateId3PayloadSize(payloadLen);
  const encodedPayloadLen = encodeSynchsafe(payloadLen);
  const out = new Uint8Array(10 + payloadLen); out.set([0x49, 0x44, 0x33, 0x03, 0x00, 0x00], 0); out.set(encodedPayloadLen, 6);
  let o = 10; for (const fr of [...keptFrames, ...replacement]) { out.set(fr, o); o += fr.length; }
  return { changed: true, tag: out };
};

export const mergeId3v23TagIntoMp3Buffer = (original: Uint8Array, draft: TagEditDraft): Uint8Array => {
  if (original.length === 0) throw new TagWriterError('InvalidTagData', 'Empty audio buffer.');
  const header = readId3Header(original);
  if (header?.major === 4) {
    if (!hasAnyTagEditIntent(draft)) return original.slice();
    throw new TagWriterError('WriteNotImplemented', 'Rewriting existing ID3v2.4 tags is not supported yet.');
  }
  const existing = header ? parseFrames(original, header) : [];
  const audio = header ? original.slice(header.audioStart) : original.slice();
  const rewrite = buildId3v23TagFromDraft(draft, existing);
  if (!rewrite.changed) return original.slice();
  const tag = rewrite.tag ?? new Uint8Array(0);
  const out = new Uint8Array(tag.length + audio.length); out.set(tag, 0); out.set(audio, tag.length); return out;
};
const applyMp4TagEditToBuffer = (original: Uint8Array, draft: TagEditDraft): Uint8Array => {
  if (!hasAnyTagEditIntent(draft)) return original.slice();
  const top = parseAtoms(original, 0, original.length, true);
  const moov = top.find((a) => a.type === 'moov'); if (!moov) throw new TagWriterError('InvalidTagData', 'Missing moov atom.');
  const mdats = top.filter((a) => a.type === 'mdat'); if (mdats.length === 0) throw new TagWriterError('InvalidTagData', 'Missing mdat atom.');
  const moovChildren = parseAtoms(original, moov.payloadStart, moov.end);
  const udta = moovChildren.find((a) => a.type === 'udta'); if (!udta) throw new TagWriterError('WriteNotImplemented', 'Missing udta atom.');
  const udtaChildren = parseAtoms(original, udta.payloadStart, udta.end);
  const meta = udtaChildren.find((a) => a.type === 'meta'); if (!meta) throw new TagWriterError('WriteNotImplemented', 'Missing meta atom.');
  if (meta.payloadStart + 4 > meta.end) throw new TagWriterError('InvalidTagData', 'Invalid meta fullbox.');
  const metaChildren = parseAtoms(original, meta.payloadStart + 4, meta.end);
  const ilst = metaChildren.find((a) => a.type === 'ilst'); if (!ilst) throw new TagWriterError('WriteNotImplemented', 'Missing ilst atom.');
  const ilstChildren = parseAtoms(original, ilst.payloadStart, ilst.end);
  const normalizedTags = normalizeEditableTags(draft.tags);
  const map: Array<{ key: keyof TagEditDraft['tags']; type: Uint8Array }> = [
    { key: 'title', type: MP4_TYPES.cnam }, { key: 'artist', type: MP4_TYPES.cART }, { key: 'album', type: MP4_TYPES.calb }, { key: 'year', type: MP4_TYPES.cday }, { key: 'genre', type: MP4_TYPES.cgen }, { key: 'comment', type: MP4_TYPES.ccmt },
  ];
  const outIlst: Uint8Array[] = [];
  let changed = false;
  const editedTypes = new Set<string>([
    ...map.filter((m) => hasDraftTagIntent(draft, m.key)).map((m) => atomKey(m.type)),
    ...(hasDraftTagIntent(draft, 'trackNumber') ? ['trkn'] : []),
    ...(hasDraftTagIntent(draft, 'discNumber') ? ['disk'] : []),
    ...(draft.removeCover || draft.cover ? ['covr'] : []),
  ]);
  for (const item of ilstChildren) {
    const key = atomKey(item.typeBytes);
    if (!editedTypes.has(key)) outIlst.push(original.slice(item.start, item.end));
  }
  for (const m of map) {
    if (!hasDraftTagIntent(draft, m.key)) continue;
    changed = true;
    const value = normalizedTags[m.key];
    if (!value) continue;
    outIlst.push(rebuildAtom(m.type, buildDataAtom(1, textEncoder.encode(value))));
  }
  const applyPacked = (field: 'trackNumber' | 'discNumber', type: Uint8Array): void => {
    if (!hasDraftTagIntent(draft, field)) return;
    changed = true;
    const value = normalizedTags[field];
    if (!value) return;
    outIlst.push(buildPackedNumberAtom(type, value));
  };
  applyPacked('trackNumber', MP4_TYPES.trkn);
  applyPacked('discNumber', MP4_TYPES.disk);
  if (draft.removeCover) {
    changed = changed || ilstChildren.some((x) => sameType(x.typeBytes, MP4_TYPES.covr));
  } else if (draft.cover) {
    changed = true;
    outIlst.push(rebuildAtom(MP4_TYPES.covr, buildDataAtom(draft.cover.mimeType === 'image/png' ? 14 : 13, draft.cover.data)));
  }
  const newIlst = rebuildAtom(MP4_TYPES.ilst, concatBytes(outIlst));
  const newMetaChildren = metaChildren.map((a) => a === ilst ? newIlst : original.slice(a.start, a.end));
  const newMetaPayloadChildren = concatBytes(newMetaChildren);
  const newMetaPayload = new Uint8Array(4 + newMetaPayloadChildren.length); newMetaPayload.set(original.slice(meta.payloadStart, meta.payloadStart + 4), 0); newMetaPayload.set(newMetaPayloadChildren, 4);
  const newMeta = rebuildAtom(MP4_TYPES.meta, newMetaPayload);
  const newUdtaChildren = udtaChildren.map((a) => a === meta ? newMeta : original.slice(a.start, a.end));
  const newUdta = rebuildAtom(MP4_TYPES.udta, concatBytes(newUdtaChildren));
  const newMoovChildren = moovChildren.map((a) => a === udta ? newUdta : original.slice(a.start, a.end));
  const newMoov = rebuildAtom(MP4_TYPES.moov, concatBytes(newMoovChildren));
  if (!changed) return original.slice();
  if (newMoov.length !== moov.size && mdats.some((mdat) => mdat.start >= moov.end)) throw new TagWriterError('WriteNotImplemented', 'moov-before-mdat size changes are blocked for offset safety.');
  const rebuiltTop = top.map((a) => (a === moov ? newMoov : original.slice(a.start, a.end)));
  return concatBytes(rebuiltTop);
};

export const prepareTagEditPlan = (song: Song, draft: TagEditDraft): TagEditPlan => createTagWriteOperationPlan(song, draft);
export const applyTagEditToBuffer = (buffer: Uint8Array, container: TagEditableContainer, draft: TagEditDraft): Uint8Array => {
  const normalized = { ...draft, cover: draft.removeCover ? undefined : draft.cover };
  const validation = validateEditableTags(normalized.tags);
  if (!validation.valid) throw new TagWriterError('InvalidTagData', validation.errors.join('; '));
  if (buffer.length === 0) throw new TagWriterError('InvalidTagData', 'Empty audio buffer.');
  if (!validateCoverPayload(normalized.cover)) throw new TagWriterError('InvalidTagData', 'Invalid cover payload.');
  if (container === 'unsupported') throw new TagWriterError('UnsupportedFormat', 'Container not supported.');
  if (container === 'm4a' || container === 'mp4') return applyMp4TagEditToBuffer(buffer, normalized);
  if (container === 'mp3') return mergeId3v23TagIntoMp3Buffer(buffer, normalized);
  throw new TagWriterError('UnsupportedFormat', 'Unknown container.');
};

export const ensureTagEditWriteAllowed = (song: Song, platform?: string): void => {
  const capability = getTagEditCapability(song, platform);
  const container = getSupportedContainer(song);
  if (container === 'unsupported') throw new TagWriterError('UnsupportedFormat', 'Container not supported for writing.');
  if (!song.fileInfo?.uri && !song.uri) throw new TagWriterError('UnsupportedUri', 'Song has no editable URI.');
  if (capability.uriType === 'remote' || capability.uriType === 'unknown') throw new TagWriterError('UnsupportedUri', capability.reason ?? 'URI is not writable.');
  if (capability.uriType === 'content') throw new TagWriterError('MissingWritePermission', 'SAF write permission and safe write flow are required.');
  if (!capability.canWrite) throw new TagWriterError('WriteNotImplemented', capability.reason ?? 'Writing is not supported for this target.');
};
export const prepareWriteOnly = (song: Song, draft: TagEditDraft): TagEditPlan => createTagWriteOperationPlan(song, draft);
export const dryRunWriteTags = (song: Song, draft: TagEditDraft): WriteOrchestrationResult => { const plan = createTagWriteOperationPlan(song, draft); return simulateTagWriteOperation(plan); };



const areBytesEqual = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((value, index) => value === b[index]);


const writeLocksByUri = new Map<string, Promise<void>>();

const withUriWriteLock = async <T>(uri: string, operation: () => Promise<T>): Promise<T> => {
  const previous = writeLocksByUri.get(uri) ?? Promise.resolve();
  let releaseCurrent: (() => void) | undefined;
  const current = new Promise<void>((resolve) => { releaseCurrent = resolve; });
  const queueTail = previous.then(() => current);
  writeLocksByUri.set(uri, queueTail);
  await previous;
  try {
    return await operation();
  } finally {
    releaseCurrent?.();
    if (writeLocksByUri.get(uri) === queueTail) writeLocksByUri.delete(uri);
  }
};
const buildAttemptScopedUri = (uri: string, suffix: 'bak' | 'tmp'): string => {
  const entropy = Math.random().toString(36).slice(2, 10);
  const attemptId = `${Date.now()}-${entropy}`;
  return `${uri}.${attemptId}.${suffix}`;
};
export const writeTagsToFile = async (
  song: Song,
  draft: TagEditDraft,
  options?: { adapter?: TagFileWriteAdapter },
): Promise<WriteTagsResult> => {
  const uri = song.fileInfo?.uri ?? song.uri;
  if (!uri) throw new TagWriterError('UnsupportedUri', 'Song has no editable URI.');
  return withUriWriteLock(uri, async () => {
    const container = getSupportedContainer(song);
    const adapter = options?.adapter ?? expoTagFileWriteAdapter;
    const canReplace = typeof adapter.canReplaceExistingFile === 'function'
      ? await adapter.canReplaceExistingFile()
      : adapter.canReplaceExistingFile !== false;
    ensureTagEditWriteAllowed(song, canReplace ? 'android' : 'web');
    if (!canReplace) {
      throw new TagWriterError('WriteNotImplemented', 'Safe existing file replacement is not supported on this platform yet.');
    }
    if (!validateEditableTags(draft.tags).valid || !validateCoverPayload(draft.removeCover ? undefined : draft.cover)) {
      throw new TagWriterError('InvalidTagData', 'Draft validation failed.');
    }
    let info: { exists: boolean; size?: number; isDirectory?: boolean };
    try {
      info = await adapter.getInfo(uri);
    } catch (error) {
      throw new TagWriterError('UnsupportedUri', `Target file info could not be read: ${String(error)}`);
    }
    if (!info.exists) throw new TagWriterError('UnsupportedUri', 'Target file is not readable.');
    let original: Uint8Array;
    try {
      original = await adapter.readBytes(uri);
    } catch (error) {
      throw new TagWriterError('UnsupportedUri', `Target file could not be read: ${String(error)}`);
    }
    const next = applyTagEditToBuffer(original, container, draft);
    if (areBytesEqual(original, next)) return { status: 'noop', sourceUri: uri, bytesBefore: original.length, bytesAfter: next.length, warnings: [] };
    const backupUri = buildAttemptScopedUri(uri, 'bak');
    const tempUri = buildAttemptScopedUri(uri, 'tmp');
    const cleanupBackupAndTemp = async (): Promise<void> => {
      try { await adapter.deleteFile(tempUri); } catch { /* noop */ }
      try { await adapter.deleteFile(backupUri); } catch { /* noop */ }
    };
    try { await adapter.copyFile(uri, backupUri); } catch { throw new TagWriterError('BackupFailed', 'Backup creation failed.'); }
    try { await adapter.writeBytes(tempUri, next); } catch {
      await cleanupBackupAndTemp();
      throw new TagWriterError('TempWriteFailed', 'Temp file write failed.');
    }
    let tempBytes: Uint8Array;
    try {
      tempBytes = await adapter.readBytes(tempUri);
    } catch (error) {
      await cleanupBackupAndTemp();
      throw new TagWriterError('VerificationFailed', `Temp output could not be verified: ${String(error)}`);
    }
    if (!areBytesEqual(tempBytes, next)) {
      await cleanupBackupAndTemp();
      throw new TagWriterError('VerificationFailed', 'Temp output bytes do not match rewritten payload.');
    }
    try { await adapter.moveOrReplaceFile(tempUri, uri); } catch (error) {
      try {
        await adapter.copyFile(backupUri, uri);
        const rollbackWarnings = [`Replace failed and rollback restored backup: ${String(error)}`];
        try { await adapter.deleteFile(tempUri); } catch { rollbackWarnings.push('Temp cleanup failed after rollback; temp file retained.'); }
        try { await adapter.deleteFile(backupUri); } catch { rollbackWarnings.push('Backup cleanup failed after rollback; backup file retained.'); }
        return {
          status: 'rolledBack',
          sourceUri: uri,
          backupUri,
          tempUri,
          bytesBefore: original.length,
          bytesAfter: original.length,
          warnings: rollbackWarnings,
        };
      } catch {
        throw new TagWriterError('RollbackFailed', `Replace failed and rollback failed: ${String(error)}`);
      }
    }
    const warnings: string[] = [];
    try { await adapter.deleteFile(tempUri); } catch { warnings.push('Temp cleanup failed; temp file retained.'); }
    try { await adapter.deleteFile(backupUri); } catch { warnings.push('Backup cleanup failed; backup file retained.'); }
    return { status: 'written', sourceUri: uri, backupUri, tempUri, bytesBefore: original.length, bytesAfter: next.length, warnings };
  });
};
