import { useEffect, type MutableRefObject } from 'react';
import type { Song } from '../types/Song';
import { cleanupCoverCache } from '../utils/coverCacheCleanup';
import { StorageKeys } from '../utils/storage';
import { acquireSongCoverProtection } from './songCoverProtectionLifecycle';
import {
  persistIfChanged,
  prepareSongsForPersistence,
} from './musicPersistenceHelpers';

const cleanupPersistedSongCovers = async (songs: Song[]): Promise<void> => {
  try {
    await cleanupCoverCache(songs);
  } catch (error) {
    console.warn('[usePersistedSongs] Cover cache cleanup failed:', error);
  }
};

export const usePersistedSongs = (
  isReady: boolean,
  songs: Song[],
  setSongsState: (songs: Song[]) => void,
  persistedRefs: MutableRefObject<Record<string, string>>,
): void => {
  useEffect(() => {
    if (!isReady) return;
    const coverLease = acquireSongCoverProtection(songs);
    let cancelled = false;
    let persistenceStarted = false;
    let persistenceFinished = false;

    (async () => {
      try {
        const { sanitizedSongs, coversChanged } = await prepareSongsForPersistence(songs, coverLease.protection);
        if (cancelled) return;
        coverLease.updateSnapshot(sanitizedSongs);
        if (coversChanged) {
          coverLease.handoffToNextEffect(sanitizedSongs);
          setSongsState(sanitizedSongs);
          return;
        }
        coverLease.markPersisting();
        persistenceStarted = true;
        const persistResult = await persistIfChanged(StorageKeys.SONGS, sanitizedSongs, persistedRefs.current);
        if (persistResult.status === 'stored' || persistResult.status === 'unchanged') {
          if (cancelled) {
            coverLease.finishPersistence({ status: 'superseded' });
            persistenceFinished = true;
            return;
          }
          await cleanupPersistedSongCovers(sanitizedSongs);
        }
        coverLease.finishPersistence(persistResult);
        persistenceFinished = true;
        if (!cancelled && persistResult.status === 'failed') {
          console.warn('[usePersistedSongs] Persistence failed:', persistResult.error);
        }
      } catch (error) {
        if (persistenceStarted && !persistenceFinished) {
          coverLease.finishPersistence({ status: 'failed', error });
        }
        console.warn('[usePersistedSongs] Persistence failed:', error);
      }
    })();

    return () => {
      cancelled = true;
      coverLease.releaseCurrentOwner();
    };
  }, [isReady, persistedRefs, setSongsState, songs]);
};
