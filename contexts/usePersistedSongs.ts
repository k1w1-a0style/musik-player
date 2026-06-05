import { useEffect, useRef, type MutableRefObject } from 'react';
import type { Song } from '../types/Song';
import {
  cleanupCoverCache,
  createCoverCacheProtection,
  type CoverCacheProtection,
} from '../utils/coverCacheCleanup';
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
  const currentSongsProtectionRef = useRef<CoverCacheProtection | undefined>(undefined);

  useEffect(() => () => {
    currentSongsProtectionRef.current?.release();
    currentSongsProtectionRef.current = undefined;
  }, []);

  useEffect(() => {
    if (!isReady) return;
    const coverProtection = createCoverCacheProtection();
    coverProtection.protectSongCovers(songs);
    const previousProtection = currentSongsProtectionRef.current;
    currentSongsProtectionRef.current = coverProtection;
    previousProtection?.release();
    let canReleaseProtection = false;
    let cancelled = false;

    (async () => {
      try {
        const { sanitizedSongs, coversChanged } = await prepareSongsForPersistence(songs, coverProtection);
        coverProtection.protectSongCovers(sanitizedSongs);
        if (cancelled) return;
        if (coversChanged) {
          setSongsState(sanitizedSongs);
        }
        const persistResult = await persistIfChanged(StorageKeys.SONGS, sanitizedSongs, persistedRefs.current);
        if (cancelled) return;
        if (persistResult.status === 'stored' || persistResult.status === 'unchanged') {
          cleanupPersistedSongCovers(sanitizedSongs);
          canReleaseProtection = true;
          return;
        }
        if (persistResult.status === 'failed') {
          console.warn('[usePersistedSongs] Persistence failed:', persistResult.error);
        }
      } catch (error) {
        console.warn('[usePersistedSongs] Persistence failed:', error);
      } finally {
        if (canReleaseProtection && currentSongsProtectionRef.current === coverProtection) {
          currentSongsProtectionRef.current = undefined;
        }
        if (canReleaseProtection || currentSongsProtectionRef.current !== coverProtection) {
          coverProtection.release();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isReady, persistedRefs, setSongsState, songs]);
};
