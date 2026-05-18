import type { Song } from '../types/Song';
import { sanitizeSongsForStorage } from '../utils/coverCache';
import { didSongCoversChange } from '../utils/musicHydration';
import { storage } from '../utils/storage';

export const persistIfChanged = async <T,>(
  key: string,
  value: T,
  persistedRefs: Record<string, string>,
): Promise<void> => {
  const serialized = JSON.stringify(value);
  if (persistedRefs[key] === serialized) return;
  const stored = await storage.set(key, value);
  if (stored) persistedRefs[key] = serialized;
};

export const prepareSongsForPersistence = async (
  songs: Song[],
): Promise<{ sanitizedSongs: Song[]; coversChanged: boolean }> => {
  const sanitizedSongs = await sanitizeSongsForStorage(songs);
  return {
    sanitizedSongs,
    coversChanged: didSongCoversChange(sanitizedSongs, songs),
  };
};
