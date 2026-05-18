import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import type { ScanFolder } from '../types/ScanFolder';
import { EQ_PRESETS, type EqPresetName, type RepeatMode, type Song, type Playlist } from '../types/Song';

const PREFIX = '@musikplayer:';

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
  id: z.string().min(1),
  title: z.string(),
  artist: z.string(),
  album: z.string().optional(),
  uri: z.string().optional(),
  cover: z.string().optional(),
  duration: z.number().optional(),
  year: z.string().optional(),
  genre: z.string().optional(),
  trackNumber: z.string().optional(),
  discNumber: z.string().optional(),
  comment: z.string().optional(),
  favorite: z.boolean().optional(),
  fileInfo: songFileInfoSchema.optional(),
  audioInfo: songAudioInfoSchema.optional(),
  coverInfo: songCoverInfoSchema.optional(),
}).passthrough();

const playlistSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  songIds: z.array(z.string()),
  createdAt: z.number(),
}).passthrough();

const scanFolderSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  uri: z.string(),
  addedAt: z.number(),
  enabled: z.boolean(),
}).passthrough();

const eqPresetSchema = z.union([
  z.enum(Object.keys(EQ_PRESETS) as [EqPresetName, ...EqPresetName[]]),
  z.literal('custom'),
]);

const repeatModeSchema = z.enum(['off', 'one', 'all']);

const parseArray = <T>(value: unknown, schema: z.ZodType<T>): T[] | null => {
  if (!Array.isArray(value)) return null;
  return value.reduce<T[]>((validItems, item) => {
    const parsed = schema.safeParse(item);
    if (parsed.success) validItems.push(parsed.data);
    return validItems;
  }, []);
};

const parseScalar = <T>(value: unknown, schema: z.ZodType<T>): T | null => {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const parseStoredValue = (key: string, value: unknown): unknown | null => {
  switch (key as StorageKey) {
    case StorageKeys.SONGS:
      return parseArray(value, songSchema);
    case StorageKeys.PLAYLISTS:
      return parseArray(value, playlistSchema);
    case StorageKeys.SCAN_FOLDERS:
      return parseArray(value, scanFolderSchema);
    case StorageKeys.FAVORITE_SONG_IDS:
      return parseArray(value, z.string());
    case StorageKeys.CURRENT_SONG_ID:
      return parseScalar(value, z.string());
    case StorageKeys.EQ_PRESET:
      return parseScalar(value, eqPresetSchema);
    case StorageKeys.EQ_BANDS:
      return parseArray(value, z.number());
    case StorageKeys.EQ_ENABLED:
    case StorageKeys.SHUFFLE:
      return parseScalar(value, z.boolean());
    case StorageKeys.VOLUME:
      return parseScalar(value, z.number().finite().min(0).max(1));
    case StorageKeys.REPEAT_MODE:
      return parseScalar(value, repeatModeSchema);
    default:
      return value;
  }
};

export const storage = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(PREFIX + key);
      if (raw == null) return null;
      const parsed = JSON.parse(raw) as unknown;
      return parseStoredValue(key, parsed) as T | null;
    } catch {
      return null;
    }
  },
  async set<T>(key: string, value: T): Promise<boolean> {
    try {
      await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(PREFIX + key);
    } catch {
      /* ignore */
    }
  },
};

export const getFavoriteSongIds = async (): Promise<string[]> => {
  const value = await storage.get<unknown>(StorageKeys.FAVORITE_SONG_IDS);
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
};

export const isFavoriteSongId = async (songId: string): Promise<boolean> => {
  const ids = await getFavoriteSongIds();
  return ids.includes(songId);
};

export const setFavoriteSongId = async (songId: string, favorite: boolean): Promise<string[]> => {
  const ids = await getFavoriteSongIds();
  const next = favorite
    ? Array.from(new Set([...ids, songId]))
    : ids.filter(id => id !== songId);
  const stored = await storage.set(StorageKeys.FAVORITE_SONG_IDS, next);
  if (!stored) throw new Error('Failed to persist favorite song ids');
  return next;
};

export const getScanFolders = async (): Promise<ScanFolder[]> => {
  const value = await storage.get<unknown>(StorageKeys.SCAN_FOLDERS);
  return Array.isArray(value) ? value : [];
};

export const saveScanFolders = async (folders: ScanFolder[]): Promise<void> => {
  await storage.set(StorageKeys.SCAN_FOLDERS, folders);
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