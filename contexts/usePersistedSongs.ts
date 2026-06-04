import { useEffect, type MutableRefObject } from 'react';
import type { Song } from '../types/Song';
import { cleanupCoverCache } from '../utils/coverCacheCleanup';
import { StorageKeys } from '../utils/storage';
import {
  persistIfChanged,
  prepareSongsForPersistence,
} from './musicPersistenceHelpers';

const cleanupPersistedSongCovers = (songs: Song[]): void => {
  void cleanupCoverCache(songs).catch(error => {
    console.warn('[usePersistedSongs] Cover cache cleanup failed:', error);
  });
};

export const usePersistedSongs = (
  isReady: boolean,
  songs: Song[],
  setSongsState: (songs: Song[]) => void,
  persistedRefs: MutableRefObject<Record<string, string>>,
): void => {
  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;

    (async () => {
      try {
        const { sanitizedSongs, coversChanged } = await prepareSongsForPersistence(songs);
        if (cancelled) return;
        if (coversChanged) {
          setSongsState(sanitizedSongs);
          return;
        }
        const persistResult = await persistIfChanged(StorageKeys.SONGS, sanitizedSongs, persistedRefs.current);
        if (cancelled) return;
        if (persistResult.status === 'stored' || persistResult.status === 'unchanged') {
          cleanupPersistedSongCovers(sanitizedSongs);
          return;
        }
        if (persistResult.status === 'failed') {
          console.warn('[usePersistedSongs] Persistence failed:', persistResult.error);
        }
      } catch (error) {
        console.warn('[usePersistedSongs] Persistence failed:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isReady, persistedRefs, setSongsState, songs]);
};
