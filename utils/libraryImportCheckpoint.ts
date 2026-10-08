import type { Song } from '../types/Song';
import { isAbortError, throwIfAborted } from './withTimeout';

export interface ImportCheckpoint {
  /** Only metadata/revision reads that completed successfully. Never deletions. */
  songs: Song[];
  sourceUri?: string;
  processed: number;
  total: number;
}
export type ImportCheckpointHandler = (checkpoint: ImportCheckpoint) => void | Promise<void>;
const CHECKPOINT_BATCH_SIZE = 100;
const CHECKPOINT_INTERVAL_MS = 500;

export class ImportCheckpointError extends Error {
  constructor(readonly cause: unknown) {
    super('Import konnte nicht sicher gespeichert werden. Bereits bestätigte Titel bleiben erhalten.');
    this.name = 'ImportCheckpointError';
  }
}

export const createImportCheckpointReporter = (onCheckpoint?: ImportCheckpointHandler, signal?: AbortSignal) => {
  let pending: Song[] = [];
  let first = true;
  let lastConfirmedAt = Date.now();
  let failure: ImportCheckpointError | undefined;
  let tail: Promise<void> = Promise.resolve();
  const flush = async (processed: number, total: number, sourceUri?: string): Promise<void> => {
    throwIfAborted(signal);
    if (failure) throw failure;
    if (!pending.length) return tail;
    const songs = pending;
    pending = []; first = false;
    const commit = tail.then(async () => {
      throwIfAborted(signal);
      if (failure) throw failure;
      try {
        await onCheckpoint?.({ songs, processed, total, sourceUri });
        lastConfirmedAt = Date.now();
      }
      catch (error) {
        if (isAbortError(error)) throw error;
        failure = new ImportCheckpointError(error);
        throw failure;
      }
    });
    // Every add/flush caller awaits this acknowledgement. A rejected batch is
    // terminal; later callers see the same failure instead of confirming a tail.
    tail = commit;
    return commit;
  };
  return {
    add: async (song: Song, processed: number, total: number, sourceUri?: string): Promise<void> => {
      throwIfAborted(signal);
      if (failure) throw failure;
      pending.push(song);
      if (first || pending.length >= CHECKPOINT_BATCH_SIZE || Date.now() - lastConfirmedAt >= CHECKPOINT_INTERVAL_MS) {
        await flush(processed, total, sourceUri);
      }
    },
    flush,
  };
};
