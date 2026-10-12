import type { CleanerSnapshot, CleanerField } from '../types/TagCleaner';
import { decodeSynchsafe } from './tagWriterId3';
import { readU32 } from './tagWriterBytes';
import { decodeCleanerId3Text } from './tagCleanerText';
import { addCleanerInventory, cleanerAscii, emptyCleanerSnapshot, CLEANER_TEXT_BUDGET, type CleanerRangeReader } from './tagCleanerReadTypes';
const fields: Record<string, CleanerField> = { TIT2: 'title', TPE1: 'artist', TPE2: 'albumArtist', TALB: 'album', TRCK: 'trackNumber', TPOS: 'discNumber', TCON: 'genre', TYER: 'year', TDRC: 'year' };
const decodeWebsite = (body: Uint8Array): string => {
  const wide = body[0] === 1 || body[0] === 2;
  const step = wide ? 2 : 1;
  let end = 1;
  while (end + step <= body.length) {
    if (body[end] === 0 && (!wide || body[end + 1] === 0)) {
      return cleanerAscii(body, end + step, body.length - end - step).replace(/\0+$/, '');
    }
    end += step;
  }
  throw new Error('WXXX-Beschreibung nicht abgeschlossen.');
};
const assignField = (snapshot: CleanerSnapshot, id: string, value: string): void => {
  const field = fields[id];
  if (!field) return;
  if (snapshot.inventory.find(item => item.id === id)!.count > 1) throw new Error(`Doppelte ${id}-Frames.`);
  if (snapshot.tags[field] !== undefined && snapshot.tags[field] !== value) throw new Error(`Mehrdeutige ${id}-Frames.`);
  if (value.includes('\0')) throw new Error(`Mehrere Werte im ${id}-Frame.`);
  snapshot.tags[field] = value;
};
const inspectFrame = async (reader: CleanerRangeReader, snapshot: CleanerSnapshot, id: string, start: number, size: number): Promise<void> => {
  const hasValue = Boolean(fields[id]) || id === 'TPUB' || id === 'WXXX';
  if (!hasValue) { addCleanerInventory(snapshot.inventory, id); return; }
  if (size < 1 || size > CLEANER_TEXT_BUDGET) throw new Error('Textframe überschreitet Lesebudget.');
  const body = await reader.read(start, size);
  const value = id === 'WXXX' ? decodeWebsite(body) : decodeCleanerId3Text(body);
  addCleanerInventory(snapshot.inventory, id, value);
  assignField(snapshot, id, value);
};
const frameSize = (header: Uint8Array, version: number): number =>
  version === 4 ? decodeSynchsafe(header.subarray(4, 8)) : readU32(header, 4);
const inspectFrames = async (reader: CleanerRangeReader, snapshot: CleanerSnapshot, version: number, end: number): Promise<void> => {
  let start = 10;
  let frames = 0;
  while (start < end) {
    if (++frames > 2048) throw new Error('Zu viele ID3-Frames.');
    const remaining = end - start;
    const header = await reader.read(start, Math.min(10, remaining));
    if (header.every(byte => byte === 0)) {
      if (!(await reader.read(start, remaining)).every(byte => byte === 0)) throw new Error('Daten nach ID3-Padding.');
      return;
    }
    if (remaining < 10) throw new Error('Abgeschnittener ID3-Frame.');
    const id = cleanerAscii(header);
    if (!/^[A-Z0-9]{4}$/.test(id) || header[8] || header[9]) throw new Error('Unbekannte oder codierte ID3-Frames.');
    const size = frameSize(header, version);
    if (start + 10 + size > end) throw new Error('ID3-Frame außerhalb des Tags.');
    await inspectFrame(reader, snapshot, id, start + 10, size);
    start += 10 + size;
  }
};
export const readCleanerId3 = async (reader: CleanerRangeReader): Promise<CleanerSnapshot> => {
  const snapshot = emptyCleanerSnapshot();
  const header = await reader.read(0, Math.min(10, reader.size));
  if (cleanerAscii(header, 0, 3) !== 'ID3') return snapshot;
  if (header.length < 10 || ![3, 4].includes(header[3]) || header[5]) throw new Error('ID3-Version oder Flags nicht sicher lesbar.');
  const end = 10 + decodeSynchsafe(header.subarray(6, 10));
  if (end > reader.size) throw new Error('ID3-Tag größer als Originaldatei.');
  await inspectFrames(reader, snapshot, header[3], end);
  return snapshot;
};
