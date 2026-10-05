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

/** Ordinary rescans use size and modification time, without reading the audio.
 * A digest is needed only for providers without dates, explicit verification,
 * or to migrate a previously stored digest to the cheap provider revision. */
export const readImportFileRevision = async (uri: string, hints: ImportFileRevision = {},
  signal?: AbortSignal, options: RevisionReadOptions = {}): Promise<ImportFileRevision> => {
  throwIfAborted(signal);
  const stat = readProviderStat(uri, hints);
  const previous = options.previous;
  if (!options.verifyContent && positive(stat.modificationTime)) {
    if (!previous?.contentHash || previous.modificationTime !== undefined) return stat;
    // Files last modified before their import already have a verified baseline.
    // Keep the existing shape while recording their provider date once.
    if (previous.size === stat.size && positive(previous.importedAt)
      && stat.modificationTime <= previous.importedAt) return { ...stat, contentHash: previous.contentHash };
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
  return current.modificationTime !== undefined && previous.modificationTime === current.modificationTime;
};
