import { EQ_BAND_COUNT, EQ_PRESETS, type EqPresetName, type Playlist, type RepeatMode, type Song } from '../types/Song';
import { sanitizeSongsForStorage } from '../utils/coverCache';
import { didSongCoversChange } from '../utils/musicHydration';
import { sanitizePlaylists } from '../utils/playlistState';
import { normalizeFavoriteSongIds, StorageKeys, storage } from '../utils/storage';

const clampVolume = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : 1;

const isRepeatMode = (value: unknown): value is RepeatMode =>
  value === 'off' || value === 'one' || value === 'all';

const isEqPresetName = (value: unknown): value is EqPresetName =>
  typeof value === 'string' && value in EQ_PRESETS;

const normalizeEqBands = (value: unknown): number[] =>
  Array.isArray(value) &&
  value.length === EQ_BAND_COUNT &&
  value.every(item => typeof item === 'number' && Number.isFinite(item))
    ? value
    : [...EQ_PRESETS.flat];

export const normalizePersistedValue = <T,>(key: string, value: T): T => {
  if (key === StorageKeys.PLAYLISTS && Array.isArray(value)) {
    return sanitizePlaylists(value as Playlist[]) as T;
  }
  if (key === StorageKeys.FAVORITE_SONG_IDS) {
    return normalizeFavoriteSongIds(value) as T;
  }
  if (key === StorageKeys.VOLUME) {
    return clampVolume(value) as T;
  }
  if (key === StorageKeys.REPEAT_MODE) {
    return (isRepeatMode(value) ? value : 'off') as T;
  }
  if (key === StorageKeys.EQ_BANDS) {
    return normalizeEqBands(value) as T;
  }
  if (key === StorageKeys.EQ_PRESET) {
    return (isEqPresetName(value) || value === 'custom' ? value : 'flat') as T;
  }
  if (key === StorageKeys.EQ_ENABLED || key === StorageKeys.SHUFFLE) {
    return (typeof value === 'boolean' ? value : false) as T;
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