import { getInfoAsync } from 'expo-file-system/legacy';
import type { SongFileInfo } from '../types/Song';
import { throwIfAborted } from './withTimeout';

export type ImportFileRevision = Pick<SongFileInfo, 'size' | 'modificationTime' | 'contentHash'>;
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

/** MediaStore supplies a modification time. SAF providers need a content digest
 * because the legacy file API does not expose their last-modified column.
 * Neither path parses tags/covers or decodes audio for unchanged files. */
export const readImportFileRevision = async (uri: string, hints: ImportFileRevision = {},
  signal?: AbortSignal): Promise<ImportFileRevision> => {
  throwIfAborted(signal);
  try {
    const info = await getInfoAsync(uri, { md5: true });
    throwIfAborted(signal);
    if (!info.exists) return hints;
    return { size: positive(info.size) ? info.size : hints.size,
      modificationTime: positive(hints.modificationTime) ? hints.modificationTime
        : positive(info.modificationTime) ? info.modificationTime : undefined,
      contentHash: info.md5 || undefined };
  } catch {
    throwIfAborted(signal);
    return hints;
  }
};

export const sameImportFileRevision = (previous: ImportFileRevision, current: ImportFileRevision): boolean => {
  if (current.contentHash) return Boolean(previous.contentHash && previous.contentHash === current.contentHash);
  if (previous.size !== undefined && current.size !== undefined && previous.size !== current.size) return false;
  return current.modificationTime !== undefined && previous.modificationTime === current.modificationTime;
};
