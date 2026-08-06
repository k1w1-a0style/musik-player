import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import type { ScanFolder } from '../types/ScanFolder';
import type { Playlist, RepeatMode, Song } from '../types/Song';
import { EQ_BAND_COUNT, EQ_PRESETS, type EqPresetName } from '../types/Song';
import { DEFAULT_LIBRARY_SORT_MODE, isLibrarySortMode, type LibrarySortMode } from './librarySort';
import { DEFAULT_LIBRARY_SONG_VIEW_MODE, isLibrarySongViewMode, type LibrarySongViewMode } from './libraryViewMode';
import { DEFAULT_LIBRARY_ALBUM_VIEW_MODE, isLibraryAlbumViewMode } from './libraryViewMode';
import type { LibraryAlbumViewMode } from '../types/LibraryView';
import { DEFAULT_APP_APPEARANCE, DEFAULT_APP_THEME_SKIN, isAppAppearance, isAppThemeSkin, type AppAppearance, type AppThemeSkin } from './appTheme';

const PREFIX = '@musikplayer:';

export type StorageOperation = 'get' | 'set' | 'remove';

export class StorageOperationError extends Error {
  readonly operation: StorageOperation;
  readonly key: string;
  readonly originalError: unknown;

  constructor(operation: StorageOperation, key: string, originalError: unknown) {
    super(`Storage ${operation} failed for key "${key}".`);
    this.name = 'StorageOperationError';
    this.operation = operation;
    this.key = key;
    this.originalError = originalError;
  }
}

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
  LEGACY_SONG_FAVORITES_MIGRATION_COMPLETED: 'legacySongFavoritesMigrationCompleted',
  LIBRARY_SORT_MODE: 'librarySortMode',
  LIBRARY_SONG_VIEW_MODE: 'librarySongViewMode',
  ALBUM_VIEW_MODE: 'albumViewMode',
  APP_APPEARANCE: 'appAppearance',
  APP_THEME_SKIN: 'appThemeSkin',
} as const;

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];
type StoredEqPresetName = EqPresetName | 'custom';

type StorageValueByKey = {
  [StorageKeys.SONGS]: Song[];
  [StorageKeys.PLAYLISTS]: Playlist[];
  [StorageKeys.CURRENT_SONG_ID]: string;
  [StorageKeys.EQ_PRESET]: StoredEqPresetName;
  [StorageKeys.EQ_BANDS]: number[];
  [StorageKeys.EQ_ENABLED]: boolean;
  [StorageKeys.VOLUME]: number;
  [StorageKeys.REPEAT_MODE]: RepeatMode;
  [StorageKeys.SHUFFLE]: boolean;
  [StorageKeys.SCAN_FOLDERS]: ScanFolder[];
  [StorageKeys.FAVORITE_SONG_IDS]: string[];
  [StorageKeys.LEGACY_SONG_FAVORITES_MIGRATION_COMPLETED]: boolean;
  [StorageKeys.LIBRARY_SORT_MODE]: LibrarySortMode;
  [StorageKeys.LIBRARY_SONG_VIEW_MODE]: LibrarySongViewMode;
  [StorageKeys.ALBUM_VIEW_MODE]: LibraryAlbumViewMode;
  [StorageKeys.APP_APPEARANCE]: AppAppearance;
  [StorageKeys.APP_THEME_SKIN]: AppThemeSkin;
};

interface StorageApi {
  get<K extends StorageKey>(key: K): Promise<StorageValueByKey[K] | null>;
  get(key: string): Promise<unknown | null>;
  set<T>(key: string, value: T): Promise<boolean>;
  remove(key: string): Promise<void>;
  getSongs(): Promise<Song[]>;
  setSongs(songs: unknown[]): Promise<void>;
  getPlaylists(): Promise<Playlist[]>;
  setPlaylists(playlists: unknown[]): Promise<void>;
  getCurrentSongId(): Promise<string | null>;
  setCurrentSongId(songId?: string | null): Promise<void>;
  getEqPreset(): Promise<StoredEqPresetName>;
  setEqPreset(preset: StoredEqPresetName): Promise<void>;
  getEqBands(): Promise<number[]>;
  setEqBands(bands: number[]): Promise<void>;
  getEqEnabled(): Promise<boolean>;
  setEqEnabled(enabled: boolean): Promise<void>;
  getVolume(): Promise<number>;
  setVolume(volume: number): Promise<void>;
  getRepeatMode(): Promise<RepeatMode>;
  setRepeatMode(mode: RepeatMode): Promise<void>;
  getShuffle(): Promise<boolean>;
  setShuffle(enabled: boolean): Promise<void>;
  getScanFolders(): Promise<ScanFolder[]>;
  setScanFolders(folders: unknown[]): Promise<void>;
  getFavoriteSongIds(): Promise<string[]>;
  setFavoriteSongIds(songIds: string[]): Promise<void>;
  getLibrarySortMode(): Promise<LibrarySortMode>;
  setLibrarySortMode(mode: LibrarySortMode): Promise<void>;
  getLibrarySongViewMode(): Promise<LibrarySongViewMode>;
  setLibrarySongViewMode(mode: LibrarySongViewMode): Promise<void>;
  getAlbumViewMode(): Promise<LibraryAlbumViewMode>;
  setAlbumViewMode(mode: LibraryAlbumViewMode): Promise<void>;
  getAppAppearance(): Promise<AppAppearance>;
  setAppAppearance(appearance: AppAppearance): Promise<void>;
  getAppThemeSkin(): Promise<AppThemeSkin>;
  setAppThemeSkin(skin: AppThemeSkin): Promise<void>;
}

const STORAGE_KEY_VALUES: ReadonlySet<string> = new Set(Object.values(StorageKeys));

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
  albumArtist: z.preprocess(value => value === null ? undefined : value, z.string().optional()),
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
  const { favorite: _favorite, isFavorite: _isFavorite, albumArtist, ...song } = parsed.data;
  return (albumArtist === undefined ? song : { ...song, albumArtist }) as NormalizedStoredSong;
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
  let fallbackTimestamp: number | undefined;
  const getFallbackTimestamp = () => fallbackTimestamp ??= Date.now();
  const createdAt = toFiniteTimestamp(parsed.data.createdAt) ?? getFallbackTimestamp();
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

const normalizeLegacyBooleanForStorage = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
};

const normalizeLegacyVolumeForStorage = (value: unknown): number | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return normalizeVolumeForStorage(Number(trimmed));
  }
  return normalizeVolumeForStorage(value);
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
const isStoredEqPresetName = (value: unknown): value is StoredEqPresetName =>
  value === 'custom' || isEqPresetName(value);

type StoredValueValidator = (value: unknown) => unknown | null;

const normalizeStoredArray = <T>(
  value: unknown,
  normalizeItem: (item: unknown) => T | null,
): T[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    const normalized = normalizeItem(item);
    return normalized === null ? [] : [normalized];
  });
};

const STORAGE_VALUE_VALIDATORS: Readonly<Partial<Record<StorageKey, StoredValueValidator>>> = {
  [StorageKeys.SONGS]: value => normalizeStoredArray(value, normalizeStoredSong),
  [StorageKeys.PLAYLISTS]: value => normalizeStoredArray(value, normalizeStoredPlaylist),
  [StorageKeys.SCAN_FOLDERS]: value => normalizeStoredArray(value, normalizeStoredScanFolder),
  [StorageKeys.FAVORITE_SONG_IDS]: normalizeFavoriteSongIds,
  [StorageKeys.LEGACY_SONG_FAVORITES_MIGRATION_COMPLETED]: normalizeLegacyBooleanForStorage,
  [StorageKeys.CURRENT_SONG_ID]: value => normalizeStorageSongId(value) ?? null,
  [StorageKeys.EQ_PRESET]: value => isStoredEqPresetName(value) ? value : null,
  [StorageKeys.EQ_BANDS]: normalizeEqBandsForStorage,
  [StorageKeys.EQ_ENABLED]: normalizeLegacyBooleanForStorage,
  [StorageKeys.SHUFFLE]: normalizeLegacyBooleanForStorage,
  [StorageKeys.VOLUME]: normalizeLegacyVolumeForStorage,
  [StorageKeys.REPEAT_MODE]: value => isRepeatMode(value) ? value : null,
  [StorageKeys.LIBRARY_SORT_MODE]: value => isLibrarySortMode(value) ? value : null,
  [StorageKeys.LIBRARY_SONG_VIEW_MODE]: value => isLibrarySongViewMode(value) ? value : null,
  [StorageKeys.ALBUM_VIEW_MODE]: value => isLibraryAlbumViewMode(value) ? value : null,
  [StorageKeys.APP_APPEARANCE]: value => isAppAppearance(value) ? value : null,
  [StorageKeys.APP_THEME_SKIN]: value => isAppThemeSkin(value) ? value : null,
};

const validateStoredValue = (key: string, value: unknown): unknown | null => {
  const validator = Object.prototype.hasOwnProperty.call(STORAGE_VALUE_VALIDATORS, key)
    ? STORAGE_VALUE_VALIDATORS[key as StorageKey]
    : undefined;
  return validator === undefined ? value : validator(value);
};

const RAW_STRING_STORAGE_KEYS: ReadonlySet<string> = new Set([
  StorageKeys.CURRENT_SONG_ID,
  StorageKeys.EQ_PRESET,
  StorageKeys.REPEAT_MODE,
  StorageKeys.LIBRARY_SORT_MODE,
  StorageKeys.LIBRARY_SONG_VIEW_MODE,
  StorageKeys.ALBUM_VIEW_MODE,
  StorageKeys.APP_APPEARANCE,
  StorageKeys.APP_THEME_SKIN,
]);

const supportsRawStringValue = (key: string): boolean => RAW_STRING_STORAGE_KEYS.has(key);

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

const isStorageKey = (value: string): value is StorageKey => STORAGE_KEY_VALUES.has(value);

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
const setJsonItem = async <T,>(key: StorageKey, value: T): Promise<void> => {
  await setItem(key, JSON.stringify(normalizeValueForWrite(key, value)));
};
const removeItem = async (key: StorageKey): Promise<void> => {
  await AsyncStorage.removeItem(storageKey(key));
};

type MutationQueue = {
  current: Promise<void>;
};

const createMutationQueue = (): MutationQueue => ({ current: Promise.resolve() });

const runSerializedMutation = async <T,>(
  queue: MutationQueue,
  operation: () => Promise<T>,
): Promise<T> => {
  const previous = queue.current.catch(() => undefined);
  const next = previous.then(operation);
  queue.current = next.then(() => undefined, () => undefined);
  return next;
};

const favoriteSongIdsMutationQueue = createMutationQueue();
const scanFoldersMutationQueue = createMutationQueue();

export const withFavoriteSongIdsMutationLock = async <T,>(operation: () => Promise<T>): Promise<T> =>
  runSerializedMutation(favoriteSongIdsMutationQueue, operation);

export const withScanFoldersMutationLock = async <T,>(operation: () => Promise<T>): Promise<T> =>
  runSerializedMutation(scanFoldersMutationQueue, operation);

export const storage: StorageApi = {
  async get(key: string): Promise<unknown | null> {
    let raw: string | null;
    try {
      raw = await AsyncStorage.getItem(storageKey(key));
    } catch (error) {
      throw new StorageOperationError('get', key, error);
    }
    if (raw == null) return null;

    // Corrupt legacy JSON is a recoverable data problem, unlike an I/O failure.
    // Preserve the historical null fallback so hydration can sanitize it.
    try {
      return parseStoredValue(key, raw);
    } catch {
      return null;
    }
  },
  async set<T>(key: string, value: T): Promise<boolean> {
    try {
      await AsyncStorage.setItem(storageKey(key), JSON.stringify(normalizeValueForWrite(key, value)));
      return true;
    } catch (error) {
      throw new StorageOperationError('set', key, error);
    }
  },
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(storageKey(key));
    } catch (error) {
      throw new StorageOperationError('remove', key, error);
    }
  },
  async getSongs() {
    return parseNormalizedArray(await getItem(StorageKeys.SONGS), normalizeStoredSong);
  },
  async setSongs(songs: unknown[]) {
    await setJsonItem(StorageKeys.SONGS, songs);
  },
  async getPlaylists() {
    return parseNormalizedArray(await getItem(StorageKeys.PLAYLISTS), normalizeStoredPlaylist);
  },
  async setPlaylists(playlists: unknown[]) {
    await setJsonItem(StorageKeys.PLAYLISTS, playlists);
  },
  async getCurrentSongId() {
    const value = await getItem(StorageKeys.CURRENT_SONG_ID);
    return value == null ? null : (parseStoredValue(StorageKeys.CURRENT_SONG_ID, value) as string | null);
  },
  async setCurrentSongId(songId?: string | null) {
    const normalizedSongId = normalizeStorageSongId(songId);
    if (!normalizedSongId) {
      await removeItem(StorageKeys.CURRENT_SONG_ID);
      return;
    }
    await setJsonItem(StorageKeys.CURRENT_SONG_ID, normalizedSongId);
  },
  async getEqPreset(): Promise<StoredEqPresetName> {
    const value = await getItem(StorageKeys.EQ_PRESET);
    const parsed = value == null ? null : parseStoredValue(StorageKeys.EQ_PRESET, value);
    return isStoredEqPresetName(parsed) ? parsed : 'flat';
  },
  async setEqPreset(preset: StoredEqPresetName) {
    const next = isStoredEqPresetName(preset) ? preset : 'flat';
    await setJsonItem(StorageKeys.EQ_PRESET, next);
  },
  async getEqBands() {
    const value = await getItem(StorageKeys.EQ_BANDS);
    if (!value) return [...EQ_PRESETS.flat];
    const parsed = parseStoredValue(StorageKeys.EQ_BANDS, value);
    return Array.isArray(parsed) ? (parsed as number[]) : [...EQ_PRESETS.flat];
  },
  async setEqBands(bands: number[]) {
    await setJsonItem(StorageKeys.EQ_BANDS, normalizeEqBandsForStorage(bands) ?? EQ_PRESETS.flat);
  },
  async getEqEnabled() {
    const value = await getItem(StorageKeys.EQ_ENABLED);
    if (value == null) return false;
    const parsed = parseStoredValue(StorageKeys.EQ_ENABLED, value);
    return typeof parsed === 'boolean' ? parsed : false;
  },
  async setEqEnabled(enabled: boolean) {
    await setJsonItem(StorageKeys.EQ_ENABLED, enabled);
  },
  async getVolume() {
    const value = await getItem(StorageKeys.VOLUME);
    if (value == null) return 1;
    const parsed = parseStoredValue(StorageKeys.VOLUME, value);
    return typeof parsed === 'number' ? parsed : 1;
  },
  async setVolume(volume: number) {
    await setJsonItem(StorageKeys.VOLUME, normalizeVolumeForStorage(volume) ?? 1);
  },
  async getRepeatMode() {
    const value = await getItem(StorageKeys.REPEAT_MODE);
    const parsed = value == null ? null : parseStoredValue(StorageKeys.REPEAT_MODE, value);
    return parsed === 'one' || parsed === 'all' ? parsed : 'off';
  },
  async setRepeatMode(mode: 'off' | 'one' | 'all') {
    await setJsonItem(StorageKeys.REPEAT_MODE, mode);
  },
  async getShuffle() {
    const value = await getItem(StorageKeys.SHUFFLE);
    if (value == null) return false;
    const parsed = parseStoredValue(StorageKeys.SHUFFLE, value);
    return typeof parsed === 'boolean' ? parsed : false;
  },
  async setShuffle(enabled: boolean) {
    await setJsonItem(StorageKeys.SHUFFLE, enabled);
  },
  async getScanFolders(): Promise<ScanFolder[]> {
    return parseNormalizedArray(await getItem(StorageKeys.SCAN_FOLDERS), normalizeStoredScanFolder);
  },
  async setScanFolders(folders: unknown[]) {
    await setJsonItem(StorageKeys.SCAN_FOLDERS, folders);
  },
  async getFavoriteSongIds(): Promise<string[]> {
    const raw = await getItem(StorageKeys.FAVORITE_SONG_IDS);
    if (raw == null) return [];
    const parsed = parseStoredValue(StorageKeys.FAVORITE_SONG_IDS, raw);
    return Array.isArray(parsed) ? parsed as string[] : [];
  },
  async setFavoriteSongIds(songIds: string[]) {
    await setJsonItem(StorageKeys.FAVORITE_SONG_IDS, normalizeFavoriteSongIds(songIds));
  },
  async getLibrarySortMode(): Promise<LibrarySortMode> {
    const value = await getItem(StorageKeys.LIBRARY_SORT_MODE);
    const parsed = value == null ? null : parseStoredValue(StorageKeys.LIBRARY_SORT_MODE, value);
    return isLibrarySortMode(parsed) ? parsed : DEFAULT_LIBRARY_SORT_MODE;
  },
  async setLibrarySortMode(mode: LibrarySortMode) {
    await setJsonItem(StorageKeys.LIBRARY_SORT_MODE, isLibrarySortMode(mode) ? mode : DEFAULT_LIBRARY_SORT_MODE);
  },
  async getLibrarySongViewMode(): Promise<LibrarySongViewMode> {
    const value = await getItem(StorageKeys.LIBRARY_SONG_VIEW_MODE);
    const parsed = value == null ? null : parseStoredValue(StorageKeys.LIBRARY_SONG_VIEW_MODE, value);
    return isLibrarySongViewMode(parsed) ? parsed : DEFAULT_LIBRARY_SONG_VIEW_MODE;
  },
  async setLibrarySongViewMode(mode: LibrarySongViewMode) {
    await setJsonItem(StorageKeys.LIBRARY_SONG_VIEW_MODE, isLibrarySongViewMode(mode) ? mode : DEFAULT_LIBRARY_SONG_VIEW_MODE);
  },
  async getAlbumViewMode(): Promise<LibraryAlbumViewMode> {
    const value = await getItem(StorageKeys.ALBUM_VIEW_MODE);
    const parsed = value == null ? null : parseStoredValue(StorageKeys.ALBUM_VIEW_MODE, value);
    return isLibraryAlbumViewMode(parsed) ? parsed : DEFAULT_LIBRARY_ALBUM_VIEW_MODE;
  },
  async setAlbumViewMode(mode: LibraryAlbumViewMode) {
    await setJsonItem(StorageKeys.ALBUM_VIEW_MODE, isLibraryAlbumViewMode(mode) ? mode : DEFAULT_LIBRARY_ALBUM_VIEW_MODE);
  },
  async getAppAppearance(): Promise<AppAppearance> {
    const value = await getItem(StorageKeys.APP_APPEARANCE);
    const parsed = value == null ? null : parseStoredValue(StorageKeys.APP_APPEARANCE, value);
    return isAppAppearance(parsed) ? parsed : DEFAULT_APP_APPEARANCE;
  },
  async setAppAppearance(appearance: AppAppearance) {
    await setJsonItem(StorageKeys.APP_APPEARANCE, isAppAppearance(appearance) ? appearance : DEFAULT_APP_APPEARANCE);
  },
  async getAppThemeSkin(): Promise<AppThemeSkin> {
    const value = await getItem(StorageKeys.APP_THEME_SKIN);
    const parsed = value == null ? null : parseStoredValue(StorageKeys.APP_THEME_SKIN, value);
    return isAppThemeSkin(parsed) ? parsed : DEFAULT_APP_THEME_SKIN;
  },
  async setAppThemeSkin(skin: AppThemeSkin) {
    await setJsonItem(StorageKeys.APP_THEME_SKIN, isAppThemeSkin(skin) ? skin : DEFAULT_APP_THEME_SKIN);
  },
};

// Named aliases are kept for production dependency injection at library-startup boundaries.
export const getFavoriteSongIds = async (): Promise<string[]> => storage.getFavoriteSongIds();

const getLegacySongFavoritesMigrationCompleted = async (): Promise<boolean> => {
  const raw = await getItem(StorageKeys.LEGACY_SONG_FAVORITES_MIGRATION_COMPLETED);
  if (raw == null) return false;
  return parseStoredValue(StorageKeys.LEGACY_SONG_FAVORITES_MIGRATION_COMPLETED, raw) === true;
};

const markLegacySongFavoritesMigrationCompleted = async (): Promise<void> => {
  await setJsonItem(StorageKeys.LEGACY_SONG_FAVORITES_MIGRATION_COMPLETED, true);
};

const tryMarkLegacySongFavoritesMigrationCompleted = async (): Promise<void> => {
  try {
    await markLegacySongFavoritesMigrationCompleted();
  } catch {
    // A failed marker write should not block startup; the safe fallback is to retry next hydration.
  }
};

export const migrateLegacySongFavoritesFromStoredSongs = async (): Promise<string[]> =>
  withFavoriteSongIdsMutationLock(async () => {
    const existingIds = await storage.getFavoriteSongIds().catch(() => []);
    const migrationCompleted = await getLegacySongFavoritesMigrationCompleted().catch(() => false);
    if (migrationCompleted) return existingIds;

    try {
      const rawSongs = await getItem(StorageKeys.SONGS);
      if (!rawSongs) {
        await tryMarkLegacySongFavoritesMigrationCompleted();
        return existingIds;
      }

      const parsedSongs = JSON.parse(rawSongs);
      const legacyIds = collectLegacyFavoriteSongIds(parsedSongs);
      if (legacyIds.length === 0) {
        await tryMarkLegacySongFavoritesMigrationCompleted();
        return existingIds;
      }

      const mergedIds = normalizeFavoriteSongIds([...existingIds, ...legacyIds]);
      if (mergedIds.length > existingIds.length) {
        await storage.setFavoriteSongIds(mergedIds);
      }
      await tryMarkLegacySongFavoritesMigrationCompleted();
      return mergedIds.length > existingIds.length ? mergedIds : existingIds;
    } catch {
      return existingIds;
    }
  });

export const isFavoriteSongId = async (songId: string): Promise<boolean> => {
  const normalizedSongId = normalizeStorageSongId(songId);
  if (!normalizedSongId) return false;
  const ids = await getFavoriteSongIds();
  return ids.includes(normalizedSongId);
};

export const setFavoriteSongId = async (songId: string, favorite: boolean): Promise<string[]> => {
  const normalizedSongId = normalizeStorageSongId(songId);
  if (!normalizedSongId) return getFavoriteSongIds();

  return withFavoriteSongIdsMutationLock(async () => {
    const ids = await getFavoriteSongIds();
    if (favorite && ids.includes(normalizedSongId)) return ids;
    if (!favorite && !ids.includes(normalizedSongId)) return ids;
    const next = favorite
      ? normalizeFavoriteSongIds([...ids, normalizedSongId])
      : ids.filter(id => id !== normalizedSongId);
    try {
      await storage.setFavoriteSongIds(next);
    } catch (error) {
      throw new Error(`Failed to persist favorite song ids: ${String(error)}`);
    }
    return next;
  });
};

// Named aliases are kept for production dependency injection at library-startup boundaries.
export const getScanFolders = async (): Promise<ScanFolder[]> => storage.getScanFolders();

const getScanFolderIdentity = (folder: ScanFolder): string => folder.id || folder.uri;

const mergeScanFolder = (currentFolder: ScanFolder | undefined, incomingFolder: ScanFolder): ScanFolder => {
  if (!currentFolder) return incomingFolder;
  // Current-wins is intentional: snapshot saves must not overwrite newer targeted mutations.
  return { ...incomingFolder, ...currentFolder };
};

const mergeScanFolderSnapshots = (currentFolders: ScanFolder[], incomingFolders: ScanFolder[]): ScanFolder[] => {
  const currentFoldersByIdentity = new Map(currentFolders.map(folder => [getScanFolderIdentity(folder), folder]));
  const incomingIdentities = new Set(incomingFolders.map(getScanFolderIdentity));
  const mergedIncomingFolders = incomingFolders.map(folder =>
    mergeScanFolder(currentFoldersByIdentity.get(getScanFolderIdentity(folder)), folder),
  );
  const currentOnlyFolders = currentFolders.filter(folder => !incomingIdentities.has(getScanFolderIdentity(folder)));
  return [...mergedIncomingFolders, ...currentOnlyFolders];
};

export const saveScanFolders = async (folders: ScanFolder[]): Promise<void> => {
  // Exported for snapshot-style persistence/tests only: this is a current-wins merge, not a blind replace.
  await withScanFoldersMutationLock(async () => {
    const currentFolders = await getScanFolders();
    await storage.setScanFolders(mergeScanFolderSnapshots(currentFolders, folders));
  });
};

export const addScanFolder = async (folder: ScanFolder): Promise<ScanFolder[]> =>
  withScanFoldersMutationLock(async () => {
    const folders = await getScanFolders();
    if (folders.some(existing => existing.uri === folder.uri)) return folders;
    const next = [...folders, folder];
    await storage.setScanFolders(next);
    return next;
  });

export const removeScanFolder = async (id: string): Promise<ScanFolder[]> =>
  withScanFoldersMutationLock(async () => {
    const folders = await getScanFolders();
    const next = folders.filter(folder => folder.id !== id);
    if (next.length === folders.length) return folders;
    await storage.setScanFolders(next);
    return next;
  });

const isSameScanFolderShallow = (left: ScanFolder, right: ScanFolder): boolean =>
  Object.keys(left).length === Object.keys(right).length
  && Object.entries(left).every(([key, value]) =>
    Object.is(value, right[key as keyof ScanFolder]),
  );

export const updateScanFolder = async (id: string, patch: Partial<ScanFolder>): Promise<ScanFolder[]> =>
  withScanFoldersMutationLock(async () => {
    const folders = await getScanFolders();
    let changed = false;
    const next = folders.map(folder => {
      if (folder.id !== id) return folder;
      const candidate = { ...folder, ...patch, id: folder.id };
      if (isSameScanFolderShallow(folder, candidate)) return folder;
      changed = true;
      return candidate;
    });
    if (!changed) return folders;
    await storage.setScanFolders(next);
    return next;
  });

export const clearScanFolders = async (): Promise<void> => {
  await withScanFoldersMutationLock(async () => {
    await storage.remove(StorageKeys.SCAN_FOLDERS);
  });
};
