import type { Song } from '../types/Song';
import type { MutableRefObject } from 'react';
import { createSongPersistenceTask } from './songPersistenceTask';
import type { PersistResult } from './musicPersistenceHelpers';

export interface AcceptedSongSnapshot {
  songs: Song[];
  setSongsState: (songs: Song[]) => void;
  persistedRefs: MutableRefObject<Record<string, string>>;
  readCurrent?: () => Song[];
}
export type SongPersistenceTask = ReturnType<typeof createSongPersistenceTask>;

/** One shared fence covers preparations as well as actual queued writes. */
export const createSongCheckpointWriter = (options: {
  accepted: () => AcceptedSongSnapshot | null;
  currentTask: MutableRefObject<SongPersistenceTask | null>;
  inFlight: MutableRefObject<Set<Promise<PersistResult>>>;
  onUnblocked: () => void;
}) => {
  let blocked = 0;
  let tail: Promise<unknown> = Promise.resolve();
  const flush = (readCurrent?: () => Song[], onConfirmed?: (songs: Song[]) => void): Promise<Song[] | undefined> => {
    blocked += 1;
    const run = tail.catch(() => undefined).then(async () => {
      options.currentTask.current?.cancel();
      while (options.inFlight.current.size) await Promise.all(options.inFlight.current);
      while (true) {
        const accepted = options.accepted();
        if (!accepted) return undefined;
        const songs = readCurrent?.() ?? accepted.readCurrent?.() ?? accepted.songs;
        const task = createSongPersistenceTask(songs, accepted.setSongsState, accepted.persistedRefs);
        const promise = task.start(true);
        options.inFlight.current.add(promise);
        void promise.then(() => { options.inFlight.current.delete(promise); });
        const result = await promise;
        if (result.status !== 'stored' && result.status !== 'unchanged') {
          throw result.status === 'failed' && result.error instanceof Error ? result.error
            : new Error('Import konnte nicht sicher gespeichert werden. Bitte erneut versuchen.');
        }
        const newest = options.accepted();
        if ((readCurrent?.() ?? newest?.readCurrent?.() ?? newest?.songs) === songs) {
          // Commit the authoritative version before ordinary flushes can resume.
          onConfirmed?.(songs);
          return songs;
        }
      }
    }).finally(() => {
      blocked -= 1;
      if (blocked === 0) options.onUnblocked();
    });
    tail = run;
    return run;
  };
  return { flush, isBlocked: (): boolean => blocked > 0 };
};
