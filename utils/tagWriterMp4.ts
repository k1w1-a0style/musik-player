import type { TagEditDraft } from '../types/TagEdit';
import { normalizeEditableTags } from './tagValidation';
import { concatBytes, readU32, textEncoder, writeU32 } from './tagWriterBytes';
import { hasAnyTagEditIntent, hasDraftTagIntent } from './tagWriterDraft';
import { TagWriterError } from './tagWriterError';

type ParsedMp4Atom = {
  start: number;
  end: number;
  headerSize: number;
  size: number;
  type: string;
  typeBytes: Uint8Array;
  payloadStart: number;
};

const atomType = (...bytes: number[]): Uint8Array => new Uint8Array(bytes);
const MP4_TYPES = {
  moov: atomType(0x6d, 0x6f, 0x6f, 0x76),
  mdat: atomType(0x6d, 0x64, 0x61, 0x74),
  udta: atomType(0x75, 0x64, 0x74, 0x61),
  meta: atomType(0x6d, 0x65, 0x74, 0x61),
  ilst: atomType(0x69, 0x6c, 0x73, 0x74),
  data: atomType(0x64, 0x61, 0x74, 0x61),
  trkn: atomType(0x74, 0x72, 0x6b, 0x6e),
  disk: atomType(0x64, 0x69, 0x73, 0x6b),
  covr: atomType(0x63, 0x6f, 0x76, 0x72),
  cnam: atomType(0xa9, 0x6e, 0x61, 0x6d),
  cART: atomType(0xa9, 0x41, 0x52, 0x54),
  aART: atomType(0x61, 0x41, 0x52, 0x54),
  calb: atomType(0xa9, 0x61, 0x6c, 0x62),
  cday: atomType(0xa9, 0x64, 0x61, 0x79),
  cgen: atomType(0xa9, 0x67, 0x65, 0x6e),
  ccmt: atomType(0xa9, 0x63, 0x6d, 0x74),
};
const atomKey = (bytes: Uint8Array): string =>
  String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
const sameType = (bytes: Uint8Array, target: Uint8Array): boolean =>
  bytes.length === 4 && bytes.every((b, i) => b === target[i]);
const parseAtoms = (
  buffer: Uint8Array,
  start: number,
  end: number,
  allowSizeZero = false,
): ParsedMp4Atom[] => {
  const atoms: ParsedMp4Atom[] = [];
  let p = start;
  while (p < end) {
    if (p + 8 > end)
      throw new TagWriterError('InvalidTagData', 'Truncated MP4 atom header.');
    const size32 = readU32(buffer, p);
    const typeBytes = buffer.slice(p + 4, p + 8);
    const type = atomKey(typeBytes);
    if (size32 === 1)
      throw new TagWriterError(
        'WriteNotImplemented',
        'MP4 largesize atoms are not supported yet.',
      );
    let size = size32;
    if (size32 === 0) {
      if (!allowSizeZero)
        throw new TagWriterError(
          'InvalidTagData',
          'Nested MP4 atom with size 0 is invalid.',
        );
      size = end - p;
    }
    if (size < 8)
      throw new TagWriterError('InvalidTagData', `Invalid MP4 atom size for ${type}.`);
    const atomEnd = p + size;
    if (atomEnd > end)
      throw new TagWriterError('InvalidTagData', `MP4 atom exceeds buffer for ${type}.`);
    atoms.push({
      start: p,
      end: atomEnd,
      headerSize: 8,
      size,
      type,
      typeBytes,
      payloadStart: p + 8,
    });
    p = atomEnd;
  }
  return atoms;
};
const rebuildAtom = (typeBytes: Uint8Array, payload: Uint8Array): Uint8Array => {
  const out = new Uint8Array(8 + payload.length);
  writeU32(out, 0, out.length);
  out.set(typeBytes, 4);
  out.set(payload, 8);
  return out;
};
const buildDataAtom = (dataType: number, payload: Uint8Array): Uint8Array => {
  const body = new Uint8Array(8 + payload.length);
  writeU32(body, 0, dataType);
  writeU32(body, 4, 0);
  body.set(payload, 8);
  return rebuildAtom(MP4_TYPES.data, body);
};
const parsePacked = (value: string): [number, number] => {
  const m = value.trim().match(/^(\d+)(?:\/(\d+))?$/);
  if (!m) throw new TagWriterError('InvalidTagData', 'Invalid packed track/disc format.');
  return [Number(m[1]), Number(m[2] ?? 0)];
};
const buildPackedNumberAtom = (type: Uint8Array, value: string): Uint8Array => {
  const [current, total] = parsePacked(value);
  const payload = new Uint8Array(8);
  payload[2] = (current >>> 8) & 0xff;
  payload[3] = current & 0xff;
  payload[4] = (total >>> 8) & 0xff;
  payload[5] = total & 0xff;
  return rebuildAtom(type, buildDataAtom(0, payload));
};

export const applyMp4TagEditToBuffer = (
  original: Uint8Array,
  draft: TagEditDraft,
): Uint8Array => {
  if (!hasAnyTagEditIntent(draft)) return original.slice();
  const top = parseAtoms(original, 0, original.length, true);
  const moov = top.find(a => a.type === 'moov');
  if (!moov) throw new TagWriterError('InvalidTagData', 'Missing moov atom.');
  const mdats = top.filter(a => a.type === 'mdat');
  if (mdats.length === 0)
    throw new TagWriterError('InvalidTagData', 'Missing mdat atom.');
  const moovChildren = parseAtoms(original, moov.payloadStart, moov.end);
  const udta = moovChildren.find(a => a.type === 'udta');
  if (!udta) throw new TagWriterError('WriteNotImplemented', 'Missing udta atom.');
  const udtaChildren = parseAtoms(original, udta.payloadStart, udta.end);
  const meta = udtaChildren.find(a => a.type === 'meta');
  if (!meta) throw new TagWriterError('WriteNotImplemented', 'Missing meta atom.');
  if (meta.payloadStart + 4 > meta.end)
    throw new TagWriterError('InvalidTagData', 'Invalid meta fullbox.');
  const metaChildren = parseAtoms(original, meta.payloadStart + 4, meta.end);
  const ilst = metaChildren.find(a => a.type === 'ilst');
  if (!ilst) throw new TagWriterError('WriteNotImplemented', 'Missing ilst atom.');
  const ilstChildren = parseAtoms(original, ilst.payloadStart, ilst.end);
  const normalizedTags = normalizeEditableTags(draft.tags);
  const map: Array<{ key: keyof TagEditDraft['tags']; type: Uint8Array }> = [
    { key: 'title', type: MP4_TYPES.cnam },
    { key: 'artist', type: MP4_TYPES.cART },
    { key: 'albumArtist', type: MP4_TYPES.aART },
    { key: 'album', type: MP4_TYPES.calb },
    { key: 'year', type: MP4_TYPES.cday },
    { key: 'genre', type: MP4_TYPES.cgen },
    { key: 'comment', type: MP4_TYPES.ccmt },
  ];
  const outIlst: Uint8Array[] = [];
  let changed = false;
  const editedTypes = new Set<string>([
    ...map.filter(m => hasDraftTagIntent(draft, m.key)).map(m => atomKey(m.type)),
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
    changed = changed || ilstChildren.some(x => sameType(x.typeBytes, MP4_TYPES.covr));
  } else if (draft.cover) {
    changed = true;
    outIlst.push(
      rebuildAtom(
        MP4_TYPES.covr,
        buildDataAtom(draft.cover.mimeType === 'image/png' ? 14 : 13, draft.cover.data),
      ),
    );
  }
  const newIlst = rebuildAtom(MP4_TYPES.ilst, concatBytes(outIlst));
  const newMetaChildren = metaChildren.map(a =>
    a === ilst ? newIlst : original.slice(a.start, a.end),
  );
  const newMetaPayloadChildren = concatBytes(newMetaChildren);
  const newMetaPayload = new Uint8Array(4 + newMetaPayloadChildren.length);
  newMetaPayload.set(original.slice(meta.payloadStart, meta.payloadStart + 4), 0);
  newMetaPayload.set(newMetaPayloadChildren, 4);
  const newMeta = rebuildAtom(MP4_TYPES.meta, newMetaPayload);
  const newUdtaChildren = udtaChildren.map(a =>
    a === meta ? newMeta : original.slice(a.start, a.end),
  );
  const newUdta = rebuildAtom(MP4_TYPES.udta, concatBytes(newUdtaChildren));
  const newMoovChildren = moovChildren.map(a =>
    a === udta ? newUdta : original.slice(a.start, a.end),
  );
  const newMoov = rebuildAtom(MP4_TYPES.moov, concatBytes(newMoovChildren));
  if (!changed) return original.slice();
  if (newMoov.length !== moov.size && mdats.some(mdat => mdat.start >= moov.end))
    throw new TagWriterError(
      'WriteNotImplemented',
      'moov-before-mdat size changes are blocked for offset safety.',
    );
  const rebuiltTop = top.map(a =>
    a === moov ? newMoov : original.slice(a.start, a.end),
  );
  return concatBytes(rebuiltTop);
};