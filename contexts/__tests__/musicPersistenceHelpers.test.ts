import AsyncStorage from '@react-native-async-storage/async-storage';
import { waitFor } from '@testing-library/react-native';
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
      { id: 'pl-1', name: 'Dirty', songIds: ['s1', 's1', 's2', 's1'], createdAt: 1, updatedAt: 1 },
    ];
    const persistedRefs: Record<string, string> = {};

    const normalized = normalizePersistedValue(StorageKeys.PLAYLISTS, dirtyPlaylists);
    expect(normalized).toEqual([
      expect.objectContaining({ id: 'pl-1', name: 'Dirty', songIds: ['s1', 's2'], createdAt: 1, updatedAt: expect.any(Number) }),
    ]);
    await persistIfChanged(StorageKeys.PLAYLISTS, dirtyPlaylists, persistedRefs);

    expect(await storage.get(StorageKeys.PLAYLISTS)).toEqual([
      expect.objectContaining({ id: 'pl-1', name: 'Dirty', songIds: ['s1', 's2'], createdAt: 1, updatedAt: expect.any(Number) }),
    ]);
    expect(persistedRefs[StorageKeys.PLAYLISTS]).toContain('\"updatedAt\":');
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


type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

const createDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('musicPersistenceHelpers persistIfChanged race handling', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('keeps the newest value when two quick updates for the same key resolve in order', async () => {
    const refs: Record<string, string> = {};
    const first = createDeferred<boolean>();
    const second = createDeferred<boolean>();
    const setSpy = jest.spyOn(storage, 'set')
      .mockImplementationOnce(async () => first.promise)
      .mockImplementationOnce(async () => second.promise);

    const firstPersist = persistIfChanged(StorageKeys.VOLUME, 0.25, refs);
    await waitFor(() => expect(setSpy).toHaveBeenCalledTimes(1));

    const secondPersist = persistIfChanged(StorageKeys.VOLUME, 0.75, refs);
    expect(setSpy).toHaveBeenCalledTimes(1);

    first.resolve(true);
    await waitFor(() => expect(setSpy).toHaveBeenCalledTimes(2));
    expect(refs[StorageKeys.VOLUME]).toBeUndefined();

    second.resolve(true);
    await expect(Promise.all([firstPersist, secondPersist])).resolves.toEqual([undefined, undefined]);
    expect(refs[StorageKeys.VOLUME]).toBe(JSON.stringify(0.75));
    expect(setSpy).toHaveBeenNthCalledWith(1, StorageKeys.VOLUME, 0.25);
    expect(setSpy).toHaveBeenNthCalledWith(2, StorageKeys.VOLUME, 0.75);
  });

  test('collapses three quick updates for the same key so only the final pending value wins', async () => {
    const refs: Record<string, string> = {};
    const first = createDeferred<boolean>();
    const second = createDeferred<boolean>();
    const setSpy = jest.spyOn(storage, 'set')
      .mockImplementationOnce(async () => first.promise)
      .mockImplementationOnce(async () => second.promise);

    const firstPersist = persistIfChanged(StorageKeys.REPEAT_MODE, 'off', refs);
    await waitFor(() => expect(setSpy).toHaveBeenCalledTimes(1));
    const secondPersist = persistIfChanged(StorageKeys.REPEAT_MODE, 'one', refs);
    const thirdPersist = persistIfChanged(StorageKeys.REPEAT_MODE, 'all', refs);

    first.resolve(true);
    await waitFor(() => expect(setSpy).toHaveBeenCalledTimes(2));
    second.resolve(true);

    await expect(Promise.all([firstPersist, secondPersist, thirdPersist])).resolves.toEqual([undefined, undefined, undefined]);
    expect(setSpy).toHaveBeenCalledTimes(2);
    expect(setSpy).toHaveBeenNthCalledWith(1, StorageKeys.REPEAT_MODE, 'off');
    expect(setSpy).toHaveBeenNthCalledWith(2, StorageKeys.REPEAT_MODE, 'all');
    expect(refs[StorageKeys.REPEAT_MODE]).toBe(JSON.stringify('all'));
  });

  test('does not globally block writes for different keys', async () => {
    const refs: Record<string, string> = {};
    const volumeWrite = createDeferred<boolean>();
    const setSpy = jest.spyOn(storage, 'set').mockImplementation(async key => {
      if (key === StorageKeys.VOLUME) return volumeWrite.promise;
      return true;
    });

    const volumePersist = persistIfChanged(StorageKeys.VOLUME, 0.5, refs);
    await waitFor(() => expect(setSpy).toHaveBeenCalledWith(StorageKeys.VOLUME, 0.5));

    await expect(persistIfChanged(StorageKeys.SHUFFLE, true, refs)).resolves.toBeUndefined();
    expect(refs[StorageKeys.SHUFFLE]).toBe(JSON.stringify(true));
    expect(refs[StorageKeys.VOLUME]).toBeUndefined();

    volumeWrite.resolve(true);
    await expect(volumePersist).resolves.toBeUndefined();
    expect(refs[StorageKeys.VOLUME]).toBe(JSON.stringify(0.5));
  });

  test('does not let a failed older write overwrite the newest successful cache value', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const refs: Record<string, string> = {};
    const first = createDeferred<boolean>();
    const second = createDeferred<boolean>();
    const setSpy = jest.spyOn(storage, 'set')
      .mockImplementationOnce(async () => first.promise)
      .mockImplementationOnce(async () => second.promise);

    const firstPersist = persistIfChanged(StorageKeys.EQ_ENABLED, false, refs);
    await waitFor(() => expect(setSpy).toHaveBeenCalledTimes(1));
    const secondPersist = persistIfChanged(StorageKeys.EQ_ENABLED, true, refs);

    first.reject(new Error('stale write failed'));
    await waitFor(() => expect(setSpy).toHaveBeenCalledTimes(2));
    second.resolve(true);

    await expect(Promise.all([firstPersist, secondPersist])).resolves.toEqual([undefined, undefined]);
    expect(refs[StorageKeys.EQ_ENABLED]).toBe(JSON.stringify(true));
    expect(warn).toHaveBeenCalledWith(
      '[MusicPersistence] Failed to persist setting.',
      expect.objectContaining({ key: StorageKeys.EQ_ENABLED, error: expect.any(Error) }),
    );
  });

  test('resolves persist errors without unhandled rejections or optimistic cache updates', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const refs: Record<string, string> = {};
    jest.spyOn(storage, 'set').mockRejectedValueOnce(new Error('persist failed'));

    await expect(persistIfChanged(StorageKeys.SHUFFLE, true, refs)).resolves.toBeUndefined();

    expect(refs[StorageKeys.SHUFFLE]).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      '[MusicPersistence] Failed to persist setting.',
      expect.objectContaining({ key: StorageKeys.SHUFFLE, error: expect.any(Error) }),
    );
  });
});
