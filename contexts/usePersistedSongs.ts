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
      } catch {
        // Persistence is best-effort; never crash provider effects because storage/cache failed.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isReady, persistedRefs, setSongsState, songs]);
};
