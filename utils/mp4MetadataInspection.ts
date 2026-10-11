import type { SongMetadataField } from '../types/Song';

type Atom = { type: string; start: number; body: number; end: number };
type ReadRange = (position: number, length: number) => Promise<Uint8Array>;
const FIELDS: Record<string, SongMetadataField> = {
  '©alb': 'album', aART: 'albumArtist', '©day': 'year', '©gen': 'genre', gnre: 'genre',
  trkn: 'trackNumber', disk: 'discNumber', '©cmt': 'comment', covr: 'cover',
};
const OPTIONAL_FIELDS: SongMetadataField[] = ['album', 'albumArtist', 'year', 'genre', 'trackNumber', 'discNumber', 'comment', 'cover'];
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'dinf', 'udta']);
const STRUCTURAL_LEAVES = new Set(['mvhd', 'tkhd', 'mdhd', 'hdlr', 'vmhd', 'smhd', 'hmhd', 'nmhd',
  'stsd', 'stts', 'ctts', 'stsc', 'stsz', 'stz2', 'stco', 'co64', 'stss', 'elst', 'dref', 'free', 'skip', 'wide']);
const OTHER_ITEMS = new Set(['©nam', '©ART', '©wrt', '©too', '©grp', '©lyr', 'cpil', 'pgap', 'tmpo', 'cprt',
  'rtng', 'stik', 'pcst', 'purl', 'egid', 'catg', 'keyw', 'soal', 'soaa', 'soar', 'sonm', 'soco', 'akID', 'plID', 'cnID', 'atID', 'geID', 'sfID']);
const TOP_LEVEL = new Set(['ftyp', 'moov', 'mdat', 'free', 'skip', 'wide']);
const u32 = (bytes: Uint8Array, offset: number): number => new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
const typeAt = (bytes: Uint8Array, offset: number): string => String.fromCharCode(...bytes.subarray(offset, offset + 4));

const atomHeader = (bytes: Uint8Array, offset: number, limit: number): Atom | undefined => {
  if (bytes.length < 8) return undefined;
  const size32 = u32(bytes, 0);
  const header = size32 === 1 ? 16 : 8;
  if (bytes.length < header || size32 === 0) return undefined;
  const size = header === 16 ? u32(bytes, 8) * 2 ** 32 + u32(bytes, 12) : size32;
  if (!Number.isSafeInteger(size) || size < header || offset + size > limit) return undefined;
  return { type: typeAt(bytes, 4), start: offset, body: offset + header, end: offset + size };
};

const children = (bytes: Uint8Array, start: number, end: number): Atom[] | undefined => {
  const result: Atom[] = [];
  while (start < end) {
    const atom = atomHeader(bytes.subarray(start, Math.min(start + 16, end)), start, end);
    if (!atom || result.length >= 1024) return undefined;
    result.push(atom); start = atom.end;
  }
  return result;
};

const inspectItems = (bytes: Uint8Array, atom: Atom, present: Set<SongMetadataField>): boolean => {
  const items = children(bytes, atom.body, atom.end);
  if (!items) return false;
  for (const item of items) {
    if (!FIELDS[item.type] && !OTHER_ITEMS.has(item.type)) return false;
    const values = children(bytes, item.body, item.end);
    if (!values?.length || values.some(value => value.type !== 'data' || value.end - value.body < 8)) return false;
    if (FIELDS[item.type]) present.add(FIELDS[item.type]);
  }
  return true;
};

type Inspection = { present: Set<SongMetadataField>; lists: number; atoms: number };
const inspectChild = (bytes: Uint8Array, child: Atom, parentType: string, inspection: Inspection, depth: number): boolean => {
  if (child.type === 'ilst' && parentType === 'meta') {
    inspection.lists += 1;
    return inspectItems(bytes, child, inspection.present);
  }
  if (CONTAINERS.has(child.type) || child.type === 'meta') return inspectContainer(bytes, child, inspection, depth + 1);
  return STRUCTURAL_LEAVES.has(child.type);
};
const inspectContainer = (bytes: Uint8Array, atom: Atom, inspection: Inspection, depth = 0): boolean => {
  if (depth > 8 || ++inspection.atoms > 4096) return false;
  const meta = atom.type === 'meta';
  if (meta && (atom.end - atom.body < 4 || u32(bytes, atom.body) !== 0)) return false;
  const nested = children(bytes, atom.body + (meta ? 4 : 0), atom.end);
  if (!nested) return false;
  return nested.every(child => inspectChild(bytes, child, atom.type, inspection, depth));
};

const hasSupportedBrand = async (atom: Atom, read: ReadRange): Promise<boolean> => {
  if (atom.end - atom.body < 8 || atom.end - atom.start > 4096) return false;
  const brand = await read(atom.body, 4);
  return brand.length === 4 && /^(M4A |M4B |isom|iso[2-9]|mp4[12])$/.test(typeAt(brand, 0));
};
const readMoov = async (atom: Atom, read: ReadRange, headLength: number, headBudget: number, tailBudget: number): Promise<Uint8Array | undefined> => {
  const length = atom.end - atom.start;
  if (length > (atom.end <= headLength ? headBudget : tailBudget)) return undefined;
  const bytes = await read(atom.start, length);
  return bytes.length === length ? bytes : undefined;
};
const readCompleteMoov = async (head: Uint8Array, size: number, read: ReadRange, headBudget: number, tailBudget: number): Promise<Uint8Array | undefined> => {
  let offset = 0; let moov: Uint8Array | undefined; let ftyp = false; let mdat = false;
  const range = async (position: number, length: number): Promise<Uint8Array> => position + length <= head.length
    ? head.subarray(position, position + length) : read(position, length);
  for (let count = 0; offset < size && count < 64; count += 1) {
    const first = await range(offset, Math.min(16, size - offset));
    const atom = atomHeader(first, offset, size);
    if (!atom || !TOP_LEVEL.has(atom.type)) return undefined;
    if (atom.type === 'ftyp') {
      if (ftyp || !await hasSupportedBrand(atom, range)) return undefined;
      ftyp = true;
    }
    if (atom.type === 'mdat') mdat ||= atom.end > atom.body;
    if (atom.type === 'moov') {
      if (moov) return undefined;
      moov = await readMoov(atom, range, head.length, headBudget, tailBudget);
      if (!moov) return undefined;
    }
    offset = atom.end;
  }
  return offset === size && ftyp && mdat ? moov : undefined;
};

/** A complete, bounded iTunes ilst hierarchy proves absence; keys/UUID/ID32,
 * freeform, truncated and unsupported layouts remain unknown. Audio mdat is skipped. */
export const inspectMp4Metadata = async (options: {
  head: Uint8Array; size: number; readRange: ReadRange; headBudget: number; tailBudget: number; includeCover: boolean;
}): Promise<{ moov: Uint8Array; absentFields: SongMetadataField[] } | undefined> => {
  if (!Number.isSafeInteger(options.size) || options.size < options.head.length || options.size <= 0) return undefined;
  const moov = await readCompleteMoov(options.head, options.size, options.readRange, options.headBudget, options.tailBudget);
  if (!moov) return undefined;
  const root = atomHeader(moov.subarray(0, 16), 0, moov.length);
  const inspection: Inspection = { present: new Set(), lists: 0, atoms: 0 };
  if (!root || !inspectContainer(moov, root, inspection) || inspection.lists !== 1) return undefined;
  return { moov, absentFields: OPTIONAL_FIELDS.filter(field => !inspection.present.has(field) && (options.includeCover || field !== 'cover')) };
};
