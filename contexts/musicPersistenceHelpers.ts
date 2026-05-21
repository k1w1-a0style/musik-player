import type { Playlist, Song } from '../types/Song';
import { sanitizeSongsForStorage } from '../utils/coverCache';
import { didSongCoversChange } from '../utils/musicHydration';
import { sanitizePlaylists } from '../utils/playlistState';
import { StorageKeys, storage } from '../utils/storage';

export const normalizePersistedValue = <T,>(key: string, value: T): T => {
  if (key === StorageKeys.PLAYLISTS && Array.isArray(value)) {
    return sanitizePlaylists(value as Playlist[]) as T;
  }
  return value;
};

export const persistIfChanged = async <T,>(
  key: string,
  value: T,
  persistedRefs: Record<string, string>,
): Promise<void> => {
  const normalizedValue = normalizePersistedValue(key, value);
  const serialized = JSON.stringify(normalizedValue);
  if (persistedRefs[key] === serialized) return;
  const stored = await storage.set(key, normalizedValue);
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