import type { MutableRefObject } from 'react';
import type { Song } from '../types/Song';
import { cleanupCoverCache } from '../utils/coverCacheCleanup';
import { StorageKeys } from '../utils/storage';
import { acquireSongCoverProtection } from './songCoverProtectionLifecycle';
import { persistIfChanged, prepareSongsForPersistence, type PersistResult } from './musicPersistenceHelpers';

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
): { start: (detached?: boolean) => Promise<PersistResult>; cancel: () => void } => {
  const coverLease = acquireSongCoverProtection(songs);
  let cancelled = false;
  let persistenceStarted = false;
  let persistenceFinished = false;
  let detached = false;
  let promise: Promise<PersistResult> | undefined;

  const isSuperseded = (): boolean => cancelled && !detached;

  const persist = async (): Promise<PersistResult> => {
    try {
      const { sanitizedSongs, coversChanged } = await prepareSongsForPersistence(songs, coverLease.protection);
      if (isSuperseded()) return { status: 'dropped' };
      coverLease.updateSnapshot(sanitizedSongs);
      if (coversChanged && !detached) {
        coverLease.handoffToNextEffect(sanitizedSongs);
        setSongsState(sanitizedSongs);
        return { status: 'dropped' };
      }
      coverLease.markPersisting();
      persistenceStarted = true;
      const persistResult = await persistIfChanged(StorageKeys.SONGS, sanitizedSongs, persistedRefs.current);
      if (persistResult.status === 'stored' || persistResult.status === 'unchanged') {
        if (isSuperseded()) {
          coverLease.finishPersistence({ status: 'superseded' });
          persistenceFinished = true;
          return { status: 'superseded' };
        }
        coverLease.prepareConfirmedCleanup(sanitizedSongs);
        await cleanupPersistedSongCovers(sanitizedSongs);
      }
      coverLease.finishPersistence(persistResult);
      persistenceFinished = true;
      if (!isSuperseded() && persistResult.status === 'failed') {
        console.warn('[usePersistedSongs] Persistence failed:', persistResult.error);
      }
      return persistResult;
    } catch (error) {
      if (persistenceStarted && !persistenceFinished) {
        coverLease.finishPersistence({ status: 'failed', error });
      }
      console.warn('[usePersistedSongs] Persistence failed:', error);
      return { status: 'failed', error };
    } finally {
      if (detached) coverLease.releaseCurrentOwner();
    }
  };

  return {
    start: (flushDetached = false) => {
      detached ||= flushDetached;
      promise ??= persist();
      return promise;
    },
    cancel: () => {
      cancelled = true;
      // A detached flush still owns its covers during asynchronous preparation.
      if (!detached) coverLease.releaseCurrentOwner();
    },
  };
};
