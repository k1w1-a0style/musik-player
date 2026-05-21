import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import type { ScanFolder } from '../types/ScanFolder';
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

const playlistSchema = z.object({
  id: z.string(),
  name: z.string(),
  songIds: z.array(z.string()).default([]),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
}).passthrough();

const scanFolderSchema = z.object({
  id: z.string(),
  name: z.string(),
  uri: z.string(),
  addedAt: z.number(),
  enabled: z.boolean().default(true),
  lastError: z.string().optional(),
}).passthrough();

const isScanFolder = (value: unknown): value is ScanFolder => scanFolderSchema.safeParse(value).success;

export const normalizeFavoriteSongIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((item): item is string => {
    if (typeof item !== 'string') return false;
    const id = item.trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  }).map(item => item.trim());
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

const filterArray = <T>(value: unknown, schema: z.ZodType<T>): T[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    const result = schema.safeParse(item);
    return result.success ? [result.data] : [];
  });
};

const parseJsonArray = <T>(value: string | null, schema: z.ZodType<T>): T[] => {
  if (!value) return [];
  try {
    return filterArray(JSON.parse(value), schema);
  } catch {
    return [];
  }
};

const isRepeatMode = (value: unknown): value is 'off' | 'one' | 'all' =>
  value === 'off' || value === 'one' || value === 'all';

const isEqPresetName = (value: unknown): value is EqPresetName =>
  typeof value === 'string' && value in EQ_PRESETS;

const isValidVolume = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

const validateStoredValue = (key: string, value: unknown): unknown | null => {
  switch (key) {
    case StorageKeys.SONGS:
      return filterArray(value, songSchema);
    case StorageKeys.PLAYLISTS:
      return filterArray(value, playlistSchema);
    case StorageKeys.SCAN_FOLDERS:
      return filterArray(value, scanFolderSchema);
    case StorageKeys.FAVORITE_SONG_IDS:
      return normalizeFavoriteSongIds(value);
    case StorageKeys.CURRENT_SONG_ID:
      return typeof value === 'string' ? value : null;
    case StorageKeys.EQ_PRESET:
      return isEqPresetName(value) ? value : null;
    case StorageKeys.EQ_BANDS:
      return normalizeEqBandsForStorage(value);
    case StorageKeys.EQ_ENABLED:
    case StorageKeys.SHUFFLE:
      return typeof value === 'boolean' ? value : null;
    case StorageKeys.VOLUME:
      return isValidVolume(value) ? value : null;
    case StorageKeys.REPEAT_MODE:
      return isRepeatMode(value) ? value : null;
    default:
      return value;
  }
};

const normalizeValueForWrite = <T,>(key: string, value: T): unknown => {
  if (key in StorageKeys || Object.values(StorageKeys).includes(key as StorageKey)) {
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
      return validateStoredValue(key, JSON.parse(raw)) as T | null;
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
    return parseJsonArray(await getItem(StorageKeys.SONGS), songSchema);
  },
  async setSongs(songs: unknown[]) {
    await setItem(StorageKeys.SONGS, JSON.stringify(songs));
  },
  async getPlaylists() {
    return parseJsonArray(await getItem(StorageKeys.PLAYLISTS), playlistSchema);
  },
  async setPlaylists(playlists: unknown[]) {
    await setItem(StorageKeys.PLAYLISTS, JSON.stringify(playlists));
  },
  async getCurrentSongId() {
    return await getItem(StorageKeys.CURRENT_SONG_ID);
  },
  async setCurrentSongId(songId?: string | null) {
    if (!songId) await removeItem(StorageKeys.CURRENT_SONG_ID);
    else await setItem(StorageKeys.CURRENT_SONG_ID, songId);
  },
  async getEqPreset(): Promise<EqPresetName> {
    const value = await getItem(StorageKeys.EQ_PRESET);
    return value && value in EQ_PRESETS ? value as EqPresetName : 'flat';
  },
  async setEqPreset(preset: EqPresetName) {
    await setItem(StorageKeys.EQ_PRESET, preset);
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
    const value = Number(await getItem(StorageKeys.VOLUME));
    return Number.isFinite(value) ? value : 1;
  },
  async setVolume(volume: number) {
    await setItem(StorageKeys.VOLUME, String(volume));
  },
  async getRepeatMode() {
    const value = await getItem(StorageKeys.REPEAT_MODE);
    return value === 'one' || value === 'all' ? value : 'off';
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
    return parseJsonArray(await getItem(StorageKeys.SCAN_FOLDERS), scanFolderSchema);
  },
  async setScanFolders(folders: ScanFolder[]) {
    await setItem(StorageKeys.SCAN_FOLDERS, JSON.stringify(folders));
  },
  async getFavoriteSongIds(): Promise<string[]> {
    return normalizeFavoriteSongIds(parseJsonArray(await getItem(StorageKeys.FAVORITE_SONG_IDS), z.string()));
  },
  async setFavoriteSongIds(songIds: string[]) {
    await setItem(StorageKeys.FAVORITE_SONG_IDS, JSON.stringify(normalizeFavoriteSongIds(songIds)));
  },
};

export const getFavoriteSongIds = async (): Promise<string[]> => storage.getFavoriteSongIds();

export const isFavoriteSongId = async (songId: string): Promise<boolean> => {
  const ids = await getFavoriteSongIds();
  return ids.includes(songId);
};

export const setFavoriteSongId = async (songId: string, favorite: boolean): Promise<string[]> => {
  const normalizedSongId = songId.trim();
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
  await storage.setScanFolders(folders.filter(isScanFolder));
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
