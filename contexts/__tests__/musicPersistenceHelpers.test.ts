import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  normalizePersistedValue,
  persistIfChanged,
  prepareSongsForPersistence,
} from '../musicPersistenceHelpers';
import { EQ_PRESETS, type Playlist, type Song } from '../../types/Song';
import { StorageKeys, storage } from '../../utils/storage';

jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///docs/',
  EncodingType: { Base64: 'base64' },
  makeDirectoryAsync: jest.fn(async () => undefined),
  writeAsStringAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///docs/',
  EncodingType: { Base64: 'base64' },
  makeDirectoryAsync: jest.fn(async () => undefined),
  writeAsStringAsync: jest.fn(async () => undefined),
  getInfoAsync: jest.fn(async () => ({ exists: false })),
}));

const songs: Song[] = [{ id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' }];

describe('musicPersistenceHelpers', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  test('persists only when serialized normalized value changes', async () => {
    const persistedRefs: Record<string, string> = {};

    await persistIfChanged(StorageKeys.VOLUME, 0.5, persistedRefs);
    expect(await storage.get(StorageKeys.VOLUME)).toBe(0.5);
    expect(persistedRefs[StorageKeys.VOLUME]).toBe(JSON.stringify(0.5));

    await storage.set(StorageKeys.VOLUME, 0.7);
    await persistIfChanged(StorageKeys.VOLUME, 0.5, persistedRefs);
    expect(await storage.get(StorageKeys.VOLUME)).toBe(0.7);
  });

  test('normalizes playlist song ids before persistence', async () => {
    const dirtyPlaylists: Playlist[] = [
      { id: 'pl-1', name: 'Dirty', songIds: ['s1', 's1', 's2', 's1'], createdAt: 1 },
    ];
    const cleanPlaylists: Playlist[] = [
      { id: 'pl-1', name: 'Dirty', songIds: ['s1', 's2'], createdAt: 1 },
    ];
    const persistedRefs: Record<string, string> = {};

    expect(normalizePersistedValue(StorageKeys.PLAYLISTS, dirtyPlaylists)).toEqual(cleanPlaylists);
    await persistIfChanged(StorageKeys.PLAYLISTS, dirtyPlaylists, persistedRefs);

    expect(await storage.get(StorageKeys.PLAYLISTS)).toEqual(cleanPlaylists);
    expect(persistedRefs[StorageKeys.PLAYLISTS]).toBe(JSON.stringify(cleanPlaylists));
  });

  test('normalizes playback and eq settings before persistence', async () => {
    expect(normalizePersistedValue(StorageKeys.VOLUME, 2)).toBe(1);
    expect(normalizePersistedValue(StorageKeys.VOLUME, -1)).toBe(0);
    expect(normalizePersistedValue(StorageKeys.REPEAT_MODE, 'bad')).toBe('off');
    expect(normalizePersistedValue(StorageKeys.EQ_PRESET, 'bad')).toBe('flat');
    expect(normalizePersistedValue(StorageKeys.EQ_PRESET, 'custom')).toBe('custom');
    expect(normalizePersistedValue(StorageKeys.EQ_BANDS, [1, 2, 3])).toEqual(EQ_PRESETS.flat);
    expect(normalizePersistedValue(StorageKeys.SHUFFLE, 'yes')).toBe(false);
    expect(normalizePersistedValue(StorageKeys.EQ_ENABLED, true)).toBe(true);
  });

  test('normalizes favorite ids before persistence', async () => {
    const persistedRefs: Record<string, string> = {};

    await persistIfChanged(StorageKeys.FAVORITE_SONG_IDS, ['s1', ' s2 ', '', 's1', 4] as unknown as string[], persistedRefs);

    expect(await storage.get(StorageKeys.FAVORITE_SONG_IDS)).toEqual(['s1', 's2']);
    expect(persistedRefs[StorageKeys.FAVORITE_SONG_IDS]).toBe(JSON.stringify(['s1', 's2']));
  });

  test('prepares songs for persistence', async () => {
    await expect(prepareSongsForPersistence(songs)).resolves.toEqual({
      sanitizedSongs: songs,
      coversChanged: false,
    });
  });
});
