import type { MutableRefObject } from 'react';
import type { Song } from '../types/Song';
import { cleanupCoverCache } from '../utils/coverCacheCleanup';
import { StorageKeys } from '../utils/storage';
import { acquireSongCoverProtection } from './songCoverProtectionLifecycle';
import { persistIfChanged, prepareSongsForPersistence } from './musicPersistenceHelpers';

const cleanupPersistedSongCovers = async (songs: Song[]): Promise<void> => {
  try {
    await cleanupCoverCache(songs);
  } catch (error) {
    console.warn('[usePersistedSongs] Cover cache cleanup failed:', error);
  }
};

export const createSongPersistenceTask = (
  songs: Song[],
  setSongsState: (songs: Song[]) => void,
  persistedRefs: MutableRefObject<Record<string, string>>,
): { start: (detached?: boolean) => void; cancel: () => void } => {
  const coverLease = acquireSongCoverProtection(songs);
  let cancelled = false;
  let persistenceStarted = false;
  let persistenceFinished = false;
  let detached = false;

  const isSuperseded = (): boolean => cancelled && !detached;

  const persist = async (): Promise<void> => {
    try {
      const { sanitizedSongs, coversChanged } = await prepareSongsForPersistence(songs, coverLease.protection);
      if (isSuperseded()) return;
      coverLease.updateSnapshot(sanitizedSongs);
      if (coversChanged && !detached) {
        coverLease.handoffToNextEffect(sanitizedSongs);
        setSongsState(sanitizedSongs);
        return;
      }
      coverLease.markPersisting();
      persistenceStarted = true;
      const persistResult = await persistIfChanged(StorageKeys.SONGS, sanitizedSongs, persistedRefs.current);
      if (persistResult.status === 'stored' || persistResult.status === 'unchanged') {
        if (isSuperseded()) {
          coverLease.finishPersistence({ status: 'superseded' });
          persistenceFinished = true;
          return;
        }
        coverLease.prepareConfirmedCleanup(sanitizedSongs);
        await cleanupPersistedSongCovers(sanitizedSongs);
      }
      coverLease.finishPersistence(persistResult);
      persistenceFinished = true;
      if (!isSuperseded() && persistResult.status === 'failed') {
        console.warn('[usePersistedSongs] Persistence failed:', persistResult.error);
      }
    } catch (error) {
      if (persistenceStarted && !persistenceFinished) {
        coverLease.finishPersistence({ status: 'failed', error });
      }
      console.warn('[usePersistedSongs] Persistence failed:', error);
    } finally {
      if (detached) coverLease.releaseCurrentOwner();
    }
  };

  return {
    start: (flushDetached = false) => { detached = flushDetached; void persist(); },
    cancel: () => { cancelled = true; coverLease.releaseCurrentOwner(); },
  };
};
