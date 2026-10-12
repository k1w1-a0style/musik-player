import type { CleanerSnapshot, CleanerField } from '../types/TagCleaner';
import { readU32 } from './tagWriterBytes';
import { decodeCleanerUtf8, decodeCleanerUtf16 } from './tagCleanerText';
import { addCleanerInventory, cleanerAscii, emptyCleanerSnapshot, CLEANER_TEXT_BUDGET, type CleanerRangeReader } from './tagCleanerReadTypes';
interface Box { type: string; start: number; body: number; end: number }
const fieldByAtom: Record<string, CleanerField> = { '\u00a9nam': 'title', '\u00a9ART': 'artist', aART: 'albumArtist', '\u00a9alb': 'album', '\u00a9day': 'year', '\u00a9gen': 'genre', '\u00a9cmt': 'comment', trkn: 'trackNumber', disk: 'discNumber' };
const readBox = async (reader: CleanerRangeReader, start: number, end: number): Promise<Box> => {
  if (end - start < 8) throw new Error('Abgeschnittener MP4-Boxheader.');
  const header = await reader.read(start, Math.min(16, end - start));
  let size = readU32(header, 0);
  let headerSize = 8;
  if (size === 1) {
    if (header.length < 16) throw new Error('Abgeschnittene 64-Bit-Box.');
    size = readU32(header, 8) * 4294967296 + readU32(header, 12);
    headerSize = 16;
  }
  if (size === 0) size = end - start;
  if (!Number.isSafeInteger(size) || size < headerSize || start + size > end) throw new Error('MP4-Box außerhalb des Containers.');
  return { type: cleanerAscii(header, 4), start, body: start + headerSize, end: start + size };
};
const numberAtom = (bytes: Uint8Array): string => {
  if (bytes.length < 6) throw new Error('Abgeschnittenes Track-/Disc-Atom.');
  const number = bytes[2] * 256 + bytes[3];
  const total = bytes[4] * 256 + bytes[5];
  return total ? `${number}/${total}` : String(number);
};
const decodeData = (type: string, bytes: Uint8Array): string => {
  if (bytes.length < 8) throw new Error('Abgeschnittenes MP4-data-Atom.');
  const payload = bytes.subarray(8);
  if (type === 'trkn' || type === 'disk') return numberAtom(payload);
  const dataType = readU32(bytes, 0) & 0xffffff;
  if (dataType === 1) return decodeCleanerUtf8(payload).replace(/\0+$/, '');
  if (dataType === 2) return decodeCleanerUtf16(payload, false).replace(/\0+$/, '');
  throw new Error('Nicht unterstütztes MP4-Textformat.');
};
const inspectItem = async (reader: CleanerRangeReader, snapshot: CleanerSnapshot, item: Box): Promise<void> => {
  const field = fieldByAtom[item.type];
  if (!field) { addCleanerInventory(snapshot.inventory, item.type); return; }
  let start = item.body;
  while (start < item.end) {
    const data = await readBox(reader, start, item.end);
    if (data.type === 'data') {
      const size = data.end - data.body;
      if (size > CLEANER_TEXT_BUDGET) throw new Error('MP4-Text überschreitet Lesebudget.');
      const value = decodeData(item.type, await reader.read(data.body, size));
      if (snapshot.tags[field] !== undefined && snapshot.tags[field] !== value) throw new Error('Mehrdeutige MP4-Metadaten.');
      snapshot.tags[field] = value;
      addCleanerInventory(snapshot.inventory, item.type, value);
    }
    start = data.end;
  }
};
const allowedChild = (parent: string, type: string): boolean =>
  (parent === 'root' && type === 'moov') || (parent === 'moov' && type === 'udta')
  || ((parent === 'moov' || parent === 'udta') && type === 'meta') || (parent === 'meta' && type === 'ilst');
const walk = async (reader: CleanerRangeReader, snapshot: CleanerSnapshot, start: number, end: number, parent: string, budget: { boxes: number }, depth = 0): Promise<void> => {
  if (depth > 5) throw new Error('MP4-Boxverschachtelung überschreitet Budget.');
  while (start < end) {
    if (++budget.boxes > 4096) throw new Error('Zu viele MP4-Boxen.');
    const box = await readBox(reader, start, end);
    if (parent === 'ilst') await inspectItem(reader, snapshot, box);
    else if (allowedChild(parent, box.type) && box.type !== 'meta')
      await walk(reader, snapshot, box.body, box.end, box.type, budget, depth + 1);
    else if (allowedChild(parent, box.type) && box.type === 'meta') {
      if (box.end - box.body < 4) throw new Error('Abgeschnittene meta-Box.');
      await walk(reader, snapshot, box.body + 4, box.end, box.type, budget, depth + 1);
    }
    start = box.end;
  }
};
export const readCleanerMp4 = async (reader: CleanerRangeReader): Promise<CleanerSnapshot> => {
  const snapshot = emptyCleanerSnapshot();
  await walk(reader, snapshot, 0, reader.size, 'root', { boxes: 0 });
  return snapshot;
};
