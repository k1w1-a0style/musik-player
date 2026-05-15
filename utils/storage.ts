import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ScanFolder } from '../types/ScanFolder';

const PREFIX = '@musikplayer:';

export const storage = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(PREFIX + key);
      if (raw == null) return null;
      return JSON.parse(raw) as T;
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

const isScanFolder = (value: unknown): value is ScanFolder => {
  if (!value || typeof value !== 'object') return false;
  const folder = value as Partial<ScanFolder>;
  return (
    typeof folder.id === 'string' &&
    typeof folder.name === 'string' &&
    typeof folder.uri === 'string' &&
    typeof folder.addedAt === 'number' &&
    typeof folder.enabled === 'boolean'
  );
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
  await storage.set(StorageKeys.FAVORITE_SONG_IDS, next);
  return next;
};

export const getScanFolders = async (): Promise<ScanFolder[]> => {
  const value = await storage.get<unknown>(StorageKeys.SCAN_FOLDERS);
  if (!Array.isArray(value)) return [];
  return value.filter(isScanFolder);
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