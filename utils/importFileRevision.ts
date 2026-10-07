import { getInfoAsync } from 'expo-file-system/legacy';
import { File } from 'expo-file-system';
import type { SongFileInfo } from '../types/Song';
import { throwIfAborted } from './withTimeout';

export type ImportFileRevision = Pick<SongFileInfo, 'size' | 'modificationTime' | 'contentHash'>;
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

interface RevisionReadOptions { previous?: SongFileInfo; verifyContent?: boolean }

const readProviderStat = (uri: string, hints: ImportFileRevision): ImportFileRevision => {
  if (positive(hints.size) && positive(hints.modificationTime)) return hints;
  try {
    // The current File API queries DocumentFile size/lastModified for SAF. The
    // legacy API opens the stream and cannot report its modification time.
    const stat = new File(uri).info();
    if (!stat.exists) return hints;
    return { size: positive(stat.size) ? stat.size : hints.size,
      modificationTime: positive(hints.modificationTime) ? hints.modificationTime
        : positive(stat.modificationTime) ? stat.modificationTime : undefined };
  } catch { return hints; }
};

/** Quick scans never open the complete audio stream. Missing provider dates are
 * an unknown revision, not a reason to hash every track. Only an explicit full
 * scan verifies the content; callers must report unverified reused sources. */
export const readImportFileRevision = async (uri: string, hints: ImportFileRevision = {},
  signal?: AbortSignal, options: RevisionReadOptions = {}): Promise<ImportFileRevision> => {
  throwIfAborted(signal);
  const stat = readProviderStat(uri, hints);
  throwIfAborted(signal);
  const previous = options.previous;
  if (!options.verifyContent) {
    // Files last modified before their import already have a verified baseline.
    // Keep the existing shape while recording their provider date once.
    if (previous?.contentHash && previous.modificationTime === undefined
      && positive(stat.modificationTime) && previous.size === stat.size && positive(previous.importedAt)
      && stat.modificationTime <= previous.importedAt) return { ...stat, contentHash: previous.contentHash };
    return stat;
  }
  try {
    const info = await getInfoAsync(uri, { md5: true });
    throwIfAborted(signal);
    if (!info.exists) return stat;
    return { size: positive(stat.size) ? stat.size : positive(info.size) ? info.size : undefined,
      modificationTime: positive(stat.modificationTime) ? stat.modificationTime
        : positive(info.modificationTime) ? info.modificationTime : undefined,
      contentHash: info.md5 || undefined };
  } catch {
    throwIfAborted(signal);
    return stat;
  }
};

export const sameImportFileRevision = (previous: ImportFileRevision, current: ImportFileRevision): boolean => {
  if (current.contentHash) return Boolean(previous.contentHash && previous.contentHash === current.contentHash);
  if (previous.size !== undefined && current.size !== undefined && previous.size !== current.size) return false;
  return positive(current.modificationTime) && previous.modificationTime === current.modificationTime;
};

export const compareImportFileRevision = (previous: ImportFileRevision, current: ImportFileRevision): 'same' | 'changed' | 'unknown' => {
  if (sameImportFileRevision(previous, current)) return 'same';
  if (previous.contentHash && current.contentHash) return 'changed';
  if (positive(previous.size) && positive(current.size) && previous.size !== current.size) return 'changed';
  if (positive(previous.modificationTime) && positive(current.modificationTime)
    && previous.modificationTime !== current.modificationTime) return 'changed';
  return 'unknown';
};
