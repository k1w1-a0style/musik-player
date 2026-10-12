import * as FileSystem from 'expo-file-system/legacy';
import type { Song } from '../types/Song';
import type { CleanerSnapshot } from '../types/TagCleaner';
import { decodeBase64ToBytes } from './base64';
import { getSupportedContainer, getUriType } from './tagEditCapability';
import { readCleanerId3 } from './tagCleanerReadId3';
import { readCleanerMp4 } from './tagCleanerReadMp4';
import { CLEANER_READ_BUDGET, type CleanerReadAdapter, type CleanerRangeReader } from './tagCleanerReadTypes';
import { withTimeout } from './withTimeout';
export const cleanerReadAdapter: CleanerReadAdapter = {
  info: uri => FileSystem.getInfoAsync(uri),
  range: async (uri, position, length) => decodeBase64ToBytes(await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64, position, length,
  })),
};
export const createCleanerRangeReader = (uri: string, size: number, adapter: CleanerReadAdapter, budget = CLEANER_READ_BUDGET): CleanerRangeReader => {
  let remaining = budget;
  return { size, read: async (position, length) => {
    if (!Number.isSafeInteger(position) || !Number.isSafeInteger(length) || position < 0 || length < 0 || position + length > size)
      throw new Error('Ungültiger Lesebereich.');
    if (length > remaining) throw new Error('Metadaten-Lesebudget überschritten.');
    remaining -= length;
    const bytes = await withTimeout(adapter.range(uri, position, length), 10000, 'Metadaten-Lesen ohne bestätigten Abschluss.');
    if (bytes.length !== length) throw new Error('Provider bestätigte den Lesebereich nicht.');
    return bytes;
  } };
};
export const readCleanerSnapshot = async (song: Song, adapter: CleanerReadAdapter = cleanerReadAdapter): Promise<CleanerSnapshot> => {
  try {
    const uri = song.fileInfo?.uri ?? song.uri;
    if (!uri || !['file', 'content'].includes(getUriType(uri))) throw new Error('Quelle nicht lokal lesbar.');
    const info = await withTimeout(adapter.info(uri), 10000, 'Dateiinformationen nicht bestätigt.');
    if (!info.exists || info.isDirectory || !Number.isSafeInteger(info.size) || info.size! < 1) throw new Error('Originalgröße nicht bestätigt.');
    const reader = createCleanerRangeReader(uri, info.size!, adapter);
    const container = getSupportedContainer(song);
    if (container === 'unsupported') throw new Error('Format: nur Anzeige-Vorschläge und Export.');
    const snapshot = container === 'mp3' ? await readCleanerId3(reader) : await readCleanerMp4(reader);
    return { ...snapshot, originalSize: info.size };
  } catch (error) { return { tags: {}, inventory: [], verified: false, error: String(error) }; }
};
