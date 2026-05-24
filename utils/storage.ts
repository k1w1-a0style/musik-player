import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import type { ScanFolder } from '../types/ScanFolder';
import type { Playlist, Song } from '../types/Song';
import { EQ_BAND_COUNT, EQ_PRESETS, type EqPresetName } from '../types/Song';

const PREFIX = '@musikplayer:';
const MIN_EQ_GAIN = -12;
const MAX_EQ_GAIN = 12;

export const StorageKeys = {
  SONGS: 'songs',
  PLAYLISTS: 'playlists',
  CURRENT_SONG_ID: 'currentSongId',
  EQ_PRESET: 'eqPreset',
  EQ_BANDS: 'eqBands',
  EQ_ENABLED: 'eqEnabled',
  VOLUME: 'volume',
  REPEAT_MODE: 'repeatMode',
  SHUFFLE: 'shuffle',
  SCAN_FOLDERS: 'scanFolders',
  FAVORITE_SONG_IDS: 'favoriteSongIds',
} as const;

type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];

const songFileInfoSchema = z.object({
  filename: z.string().optional(),
  uri: z.string().optional(),
  extension: z.string().optional(),
  container: z.string().optional(),
  mimeType: z.string().optional(),
  size: z.number().optional(),
  source: z.string().optional(),
  importedAt: z.number().optional(),
}).passthrough();

const songAudioInfoSchema = z.object({
  codec: z.string().optional(),
  bitrate: z.number().optional(),
  sampleRate: z.number().optional(),
  channels: z.number().optional(),
}).passthrough();

const songCoverInfoSchema = z.object({
  status: z.enum(['none', 'embedded', 'cached', 'external', 'unknown']).optional(),
  uri: z.string().optional(),
}).passthrough();

const songSchema = z.object({
  id: z.string(),
  title: z.string(),
  artist: z.string(),
  album: z.string().optional(),
  duration: z.number().optional(),
  cover: z.string().optional(),
  uri: z.string().optional(),
  favorite: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  year: z.string().optional(),
  genre: z.string().optional(),
  trackNumber: z.string().optional(),
  discNumber: z.string().optional(),
  comment: z.string().optional(),
  fileInfo: songFileInfoSchema.optional(),
  audioInfo: songAudioInfoSchema.optional(),
  coverInfo: songCoverInfoSchema.optional(),
}).passthrough();

type NormalizedStoredSong = Song & Record<string, unknown> & {
  favorite?: never;
  isFavorite?: never;
};

const normalizeStoredSong = (value: unknown): NormalizedStoredSong | null => {
  const parsed = songSchema.safeParse(value);
  if (!parsed.success) return null;
  const { favorite: _favorite, isFavorite: _isFavorite, ...song } = parsed.data;
  return song as NormalizedStoredSong;
};

export const collectLegacyFavoriteSongIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return normalizeFavoriteSongIds(value.flatMap(item => {
    const parsed = songSchema.safeParse(item);
    if (!parsed.success) return [];
    const id = normalizeStorageSongId(parsed.data.id);
    if (!id) return [];
    return parsed.data.favorite === true || parsed.data.isFavorite === true ? [id] : [];
  }));
};

const playlistSchema = z.object({
  id: z.string(),
  name: z.string(),
  songIds: z.array(z.string()).default([]),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
}).passthrough();

const toFiniteTimestamp = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

type NormalizedStoredPlaylist = Playlist & Record<string, unknown>;

const normalizeStoredPlaylist = (value: unknown): NormalizedStoredPlaylist | null => {
  const parsed = playlistSchema.safeParse(value);
  if (!parsed.success) return null;
  const now = Date.now();
  const createdAt = toFiniteTimestamp(parsed.data.createdAt) ?? now;
  const updatedAt = toFiniteTimestamp(parsed.data.updatedAt) ?? createdAt;
  return { ...parsed.data, createdAt, updatedAt };
};

const scanFolderSchema = z.object({
  id: z.string(),
  name: z.string(),
  uri: z.string(),
  addedAt: z.number(),
  enabled: z.boolean().default(true),
  lastError: z.string().optional(),
}).passthrough();

type NormalizedStoredScanFolder = ScanFolder & Record<string, unknown>;

const normalizeStoredScanFolder = (value: unknown): NormalizedStoredScanFolder | null => {
  const parsed = scanFolderSchema.safeParse(value);
  if (!parsed.success) return null;
  return parsed.data;
};

export const normalizeStorageSongId = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

export const normalizeFavoriteSongIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap(item => {
    const id = normalizeStorageSongId(item);
    if (!id || seen.has(id)) return [];
    seen.add(id);
    return [id];
  });
};

export const normalizeVolumeForStorage = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
};

const clampEqGain = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(MIN_EQ_GAIN, Math.min(MAX_EQ_GAIN, value));
};

export const normalizeEqBandsForStorage = (value: unknown): number[] | null => {
  if (!Array.isArray(value) || value.length !== EQ_BAND_COUNT) return null;
  if (!value.every(item => typeof item === 'number')) return null;
  return value.map(clampEqGain);
};

const parseNormalizedArray = <T>(raw: string | null, normalizeItem: (value: unknown) => T | null): T[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap(item => {
      const normalized = normalizeItem(item);
      return normalized ? [normalized] : [];
    });
  } catch {
    return [];
  }
};

const isRepeatMode = (value: unknown): value is 'off' | 'one' | 'all' =>
  value === 'off' || value === 'one' || value === 'all';

const isEqPresetName = (value: unknown): value is EqPresetName =>
  typeof value === 'string' && value in EQ_PRESETS;
type StoredEqPresetName = EqPresetName | 'custom';
const isStoredEqPresetName = (value: unknown): value is StoredEqPresetName =>
  value === 'custom' || isEqPresetName(value);

const validateStoredValue = (key: string, value: unknown): unknown | null => {
  switch (key) {
    case StorageKeys.SONGS:
      return Array.isArray(value) ? value.flatMap(item => {
        const song = normalizeStoredSong(item);
        return song ? [song] : [];
      }) : [];
    case StorageKeys.PLAYLISTS:
      return Array.isArray(value)
        ? value.flatMap(item => {
          const playlist = normalizeStoredPlaylist(item);
          return playlist ? [playlist] : [];
        })
        : [];
    case StorageKeys.SCAN_FOLDERS:
      return Array.isArray(value)
        ? value.flatMap(item => {
          const folder = normalizeStoredScanFolder(item);
          return folder ? [folder] : [];
        })
        : [];
    case StorageKeys.FAVORITE_SONG_IDS:
      return normalizeFavoriteSongIds(value);
    case StorageKeys.CURRENT_SONG_ID:
      return normalizeStorageSongId(value) ?? null;
    case StorageKeys.EQ_PRESET:
      return isStoredEqPresetName(value) ? value : null;
    case StorageKeys.EQ_BANDS:
      return normalizeEqBandsForStorage(value);
    case StorageKeys.EQ_ENABLED:
    case StorageKeys.SHUFFLE:
      return typeof value === 'boolean' ? value : null;
    case StorageKeys.VOLUME:
      return normalizeVolumeForStorage(value);
    case StorageKeys.REPEAT_MODE:
      return isRepeatMode(value) ? value : null;
    default:
      return value;
  }
};

const supportsRawStringValue = (key: string): boolean =>
  key === StorageKeys.CURRENT_SONG_ID ||
  key === StorageKeys.EQ_PRESET ||
  key === StorageKeys.REPEAT_MODE;

const parseStoredValue = (key: string, raw: string): unknown | null => {
  try {
    const jsonParsed = JSON.parse(raw);
    const parsed = validateStoredValue(key, jsonParsed);
    if (parsed != null) return parsed;
    if (supportsRawStringValue(key) && (typeof jsonParsed === 'number' || typeof jsonParsed === 'boolean')) {
      return validateStoredValue(key, raw);
    }
    return null;
  } catch {
    if (supportsRawStringValue(key)) return validateStoredValue(key, raw);
    return null;
  }
};

const isStorageKey = (value: string): value is StorageKey =>
  Object.values(StorageKeys).includes(value as StorageKey);

const normalizeValueForWrite = <T,>(key: string, value: T): unknown => {
  if (isStorageKey(key)) {
    return validateStoredValue(key, value);
  }
  return value;
};

const storageKey = (key: string): string => PREFIX + key;

const getItem = async (key: StorageKey): Promise<string | null> => AsyncStorage.getItem(storageKey(key));
const setItem = async (key: StorageKey, value: string): Promise<void> => {
  await AsyncStorage.setItem(storageKey(key), value);
};
const removeItem = async (key: StorageKey): Promise<void> => {
  await AsyncStorage.removeItem(storageKey(key));
};

export const storage = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(storageKey(key));
      if (raw == null) return null;
      return parseStoredValue(key, raw) as T | null;
    } catch {
      return null;
    }
  },
  async set<T>(key: string, value: T): Promise<boolean> {
    try {
      await AsyncStorage.setItem(storageKey(key), JSON.stringify(normalizeValueForWrite(key, value)));
      return true;
    } catch {
      return false;
    }
  },
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(storageKey(key));
    } catch {
      /* ignore */
    }
  },
  async getSongs() {
    return parseNormalizedArray(await getItem(StorageKeys.SONGS), normalizeStoredSong);
  },
  async setSongs(songs: unknown[]) {
    await setItem(StorageKeys.SONGS, JSON.stringify(normalizeValueForWrite(StorageKeys.SONGS, songs)));
  },
  async getPlaylists() {
    return parseNormalizedArray(await getItem(StorageKeys.PLAYLISTS), normalizeStoredPlaylist);
  },
  async setPlaylists(playlists: unknown[]) {
    await setItem(StorageKeys.PLAYLISTS, JSON.stringify(normalizeValueForWrite(StorageKeys.PLAYLISTS, playlists)));
  },
  async getCurrentSongId() {
    const value = await getItem(StorageKeys.CURRENT_SONG_ID);
    return value == null ? null : (parseStoredValue(StorageKeys.CURRENT_SONG_ID, value) as string | null);
  },
  async setCurrentSongId(songId?: string | null) {
    const normalizedSongId = normalizeStorageSongId(songId);
    if (!normalizedSongId) await removeItem(StorageKeys.CURRENT_SONG_ID);
    else await setItem(StorageKeys.CURRENT_SONG_ID, normalizedSongId);
  },
  async getEqPreset(): Promise<StoredEqPresetName> {
    const value = await getItem(StorageKeys.EQ_PRESET);
    const parsed = value == null ? null : parseStoredValue(StorageKeys.EQ_PRESET, value);
    return isStoredEqPresetName(parsed) ? parsed : 'flat';
  },
  async setEqPreset(preset: StoredEqPresetName) {
    await setItem(StorageKeys.EQ_PRESET, isStoredEqPresetName(preset) ? preset : 'flat');
  },
  async getEqBands() {
    const value = await getItem(StorageKeys.EQ_BANDS);
    if (!value) return [...EQ_PRESETS.flat];
    try {
      return normalizeEqBandsForStorage(JSON.parse(value)) ?? [...EQ_PRESETS.flat];
    } catch {
      return [...EQ_PRESETS.flat];
    }
  },
  async setEqBands(bands: number[]) {
    await setItem(StorageKeys.EQ_BANDS, JSON.stringify(normalizeEqBandsForStorage(bands) ?? EQ_PRESETS.flat));
  },
  async getEqEnabled() {
    return (await getItem(StorageKeys.EQ_ENABLED)) === 'true';
  },
  async setEqEnabled(enabled: boolean) {
    await setItem(StorageKeys.EQ_ENABLED, String(enabled));
  },
  async getVolume() {
    const value = await getItem(StorageKeys.VOLUME);
    if (value == null) return 1;
    const parsed = Number(value);
    return normalizeVolumeForStorage(parsed) ?? 1;
  },
  async setVolume(volume: number) {
    await setItem(StorageKeys.VOLUME, String(normalizeVolumeForStorage(volume) ?? 1));
  },
  async getRepeatMode() {
    const value = await getItem(StorageKeys.REPEAT_MODE);
    const parsed = value == null ? null : parseStoredValue(StorageKeys.REPEAT_MODE, value);
    return parsed === 'one' || parsed === 'all' ? parsed : 'off';
  },
  async setRepeatMode(mode: 'off' | 'one' | 'all') {
    await setItem(StorageKeys.REPEAT_MODE, mode);
  },
  async getShuffle() {
    return (await getItem(StorageKeys.SHUFFLE)) === 'true';
  },
  async setShuffle(enabled: boolean) {
    await setItem(StorageKeys.SHUFFLE, String(enabled));
  },
  async getScanFolders(): Promise<ScanFolder[]> {
    return parseNormalizedArray(await getItem(StorageKeys.SCAN_FOLDERS), normalizeStoredScanFolder);
  },
  async setScanFolders(folders: unknown[]) {
    await setItem(StorageKeys.SCAN_FOLDERS, JSON.stringify(normalizeValueForWrite(StorageKeys.SCAN_FOLDERS, folders)));
  },
  async getFavoriteSongIds(): Promise<string[]> {
    const raw = await getItem(StorageKeys.FAVORITE_SONG_IDS);
    if (raw == null) return [];
    const parsed = parseStoredValue(StorageKeys.FAVORITE_SONG_IDS, raw);
    return Array.isArray(parsed) ? parsed as string[] : [];
  },
  async setFavoriteSongIds(songIds: string[]) {
    await setItem(StorageKeys.FAVORITE_SONG_IDS, JSON.stringify(normalizeFavoriteSongIds(songIds)));
  },
};

export const getFavoriteSongIds = async (): Promise<string[]> => storage.getFavoriteSongIds();

export const migrateLegacySongFavoritesFromStoredSongs = async (): Promise<string[]> => {
  const existingIds = await storage.getFavoriteSongIds().catch(() => []);
  try {
    const rawSongs = await getItem(StorageKeys.SONGS);
    if (!rawSongs) return existingIds;
    const parsedSongs = JSON.parse(rawSongs);
    const legacyIds = collectLegacyFavoriteSongIds(parsedSongs);
    if (legacyIds.length === 0) return existingIds;
    const mergedIds = normalizeFavoriteSongIds([...existingIds, ...legacyIds]);
    if (mergedIds.length === existingIds.length) return existingIds;
    await storage.setFavoriteSongIds(mergedIds);
    return mergedIds;
  } catch {
    return existingIds;
  }
};

export const isFavoriteSongId = async (songId: string): Promise<boolean> => {
  const normalizedSongId = normalizeStorageSongId(songId);
  if (!normalizedSongId) return false;
  const ids = await getFavoriteSongIds();
  return ids.includes(normalizedSongId);
};

export const setFavoriteSongId = async (songId: string, favorite: boolean): Promise<string[]> => {
  const normalizedSongId = normalizeStorageSongId(songId);
  if (!normalizedSongId) return getFavoriteSongIds();
  const ids = await getFavoriteSongIds();
  const next = favorite
    ? normalizeFavoriteSongIds([...ids, normalizedSongId])
    : ids.filter(id => id !== normalizedSongId);
  try {
    await storage.setFavoriteSongIds(next);
  } catch (error) {
    throw new Error(`Failed to persist favorite song ids: ${String(error)}`);
  }
  return next;
};

export const getScanFolders = async (): Promise<ScanFolder[]> => storage.getScanFolders();

export const saveScanFolders = async (folders: ScanFolder[]): Promise<void> => {
  await storage.setScanFolders(folders);
};

export const addScanFolder = async (folder: ScanFolder): Promise<ScanFolder[]> => {
  const folders = await getScanFolders();
  if (folders.some(existing => existing.uri === folder.uri)) return folders;
  const next = [...folders, folder];
  await saveScanFolders(next);
  return next;
};

export const removeScanFolder = async (id: string): Promise<ScanFolder[]> => {
  const folders = await getScanFolders();
  const next = folders.filter(folder => folder.id !== id);
  await saveScanFolders(next);
  return next;
};

export const updateScanFolder = async (id: string, patch: Partial<ScanFolder>): Promise<ScanFolder[]> => {
  const folders = await getScanFolders();
  const next = folders.map(folder => (folder.id === id ? { ...folder, ...patch, id: folder.id } : folder));
  await saveScanFolders(next);
  return next;
};

export const clearScanFolders = async (): Promise<void> => {
  await storage.remove(StorageKeys.SCAN_FOLDERS);
};
