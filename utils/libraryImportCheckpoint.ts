import type { Song } from '../types/Song';
import { throwIfAborted } from './withTimeout';

export interface ImportCheckpoint {
  /** Only metadata/revision reads that completed successfully. Never deletions. */
  songs: Song[];
  sourceUri?: string;
  processed: number;
  total: number;
}

export const createImportCheckpointReporter = (onCheckpoint?: (checkpoint: ImportCheckpoint) => void,
  signal?: AbortSignal) => {
  let pending: Song[] = [];
  let first = true;
  const flush = (processed: number, total: number, sourceUri?: string): void => {
    throwIfAborted(signal);
    if (!pending.length) return;
    const songs = pending;
    pending = [];
    first = false;
    onCheckpoint?.({ songs, processed, total, sourceUri });
  };
  return {
    add: (song: Song, processed: number, total: number, sourceUri?: string): void => {
      throwIfAborted(signal);
      pending.push(song);
      // Commit the first accepted source promptly, then amortize state/storage
      // work for large libraries. The final/partial result flushes the tail.
      if (first || pending.length >= 20) flush(processed, total, sourceUri);
    },
    flush,
  };
};
