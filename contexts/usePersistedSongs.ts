import { useEffect, type MutableRefObject } from 'react';
import type { Song } from '../types/Song';
import { StorageKeys } from '../utils/storage';
import {
  persistIfChanged,
  prepareSongsForPersistence,
} from './musicPersistenceHelpers';

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
        await persistIfChanged(StorageKeys.SONGS, sanitizedSongs, persistedRefs.current);
      } catch (error) {
        console.warn('[usePersistedSongs] Persistence failed:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isReady, persistedRefs, setSongsState, songs]);
};
