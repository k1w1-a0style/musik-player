import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageKeys, StorageOperationError, storage } from '../storage';
import {
  MAX_SONG_LIBRARY_CHUNK_CODE_UNITS,
  resetSongLibraryStorageForTests,
  SONG_LIBRARY_CHUNK_PREFIX,
  SONG_LIBRARY_MANIFEST_KEY,
} from '../songLibraryStorage';

const legacySongsKey = '@musikplayer:songs';

describe('chunked song library storage', () => {
  beforeEach(() => {
    (AsyncStorage as unknown as { __reset: () => void }).__reset();
    resetSongLibraryStorageForTests();
    jest.restoreAllMocks();
  });

  it('round-trips a library larger than one Android cursor-safe chunk', async () => {
    const songs = [{
      id: 'large',
      title: 'x'.repeat(MAX_SONG_LIBRARY_CHUNK_CODE_UNITS * 2),
      artist: 'Artist',
    }];

    await expect(storage.set(StorageKeys.SONGS, songs)).resolves.toBe(true);
    await expect(storage.get(StorageKeys.SONGS)).resolves.toEqual(songs);

    const keys = await AsyncStorage.getAllKeys();
    expect(keys).toContain(SONG_LIBRARY_MANIFEST_KEY);
    expect(keys.filter(key => key.startsWith(SONG_LIBRARY_CHUNK_PREFIX)).length).toBeGreaterThan(1);
    await expect(AsyncStorage.getItem(legacySongsKey)).resolves.toBeNull();
  });

  it('migrates legacy JSON without deleting its rollback copy during the read', async () => {
    const songs = [{ id: 'legacy', title: 'Legacy', artist: 'Artist' }];
    const legacyJson = JSON.stringify(songs);
    await AsyncStorage.setItem(legacySongsKey, legacyJson);

    await expect(storage.get(StorageKeys.SONGS)).resolves.toEqual(songs);

    await expect(AsyncStorage.getItem(SONG_LIBRARY_MANIFEST_KEY)).resolves.not.toBeNull();
    await expect(AsyncStorage.getItem(legacySongsKey)).resolves.toBe(legacyJson);
  });

  it('keeps the committed snapshot readable when a replacement chunk write fails', async () => {
    const oldSongs = [{ id: 'old', title: 'Old', artist: 'Artist' }];
    const newSongs = [{ id: 'new', title: 'New', artist: 'Artist' }];
    await storage.set(StorageKeys.SONGS, oldSongs);
    jest.spyOn(AsyncStorage, 'multiSet').mockRejectedValueOnce(new Error('disk full'));

    await expect(storage.set(StorageKeys.SONGS, newSongs)).rejects.toMatchObject({
      name: 'StorageOperationError',
      operation: 'set',
      key: StorageKeys.SONGS,
    });
    await expect(storage.get(StorageKeys.SONGS)).resolves.toEqual(oldSongs);
  });

  it('keeps a reader on its committed snapshot while a newer revision is written', async () => {
    const oldSongs = [{ id: 'old', title: 'Old', artist: 'Artist' }];
    const newSongs = [{ id: 'new', title: 'New', artist: 'Artist' }];
    await storage.set(StorageKeys.SONGS, oldSongs);
    const oldChunkKey = (await AsyncStorage.getAllKeys())
      .find(key => key.startsWith(SONG_LIBRARY_CHUNK_PREFIX));
    expect(oldChunkKey).toBeDefined();

    let releaseRead!: () => void;
    let markReadStarted!: () => void;
    const readRelease = new Promise<void>(resolve => { releaseRead = resolve; });
    const readStarted = new Promise<void>(resolve => { markReadStarted = resolve; });
    let shouldHoldRead = true;
    jest.spyOn(AsyncStorage, 'multiGet').mockImplementation(async keys => {
      if (shouldHoldRead && keys.includes(oldChunkKey!)) {
        shouldHoldRead = false;
        markReadStarted();
        await readRelease;
      }
      return Promise.all(keys.map(async key => [key, await AsyncStorage.getItem(key)] as [string, string | null]));
    });

    const readPromise = storage.get(StorageKeys.SONGS);
    await readStarted;
    const writePromise = storage.set(StorageKeys.SONGS, newSongs);
    await new Promise(resolve => setTimeout(resolve, 0));
    releaseRead();

    await expect(readPromise).resolves.toEqual(oldSongs);
    await expect(writePromise).resolves.toBe(true);
    await expect(storage.get(StorageKeys.SONGS)).resolves.toEqual(newSongs);
  });

  it('falls back to legacy JSON when the chunked snapshot is corrupt', async () => {
    const songs = [{ id: 'legacy', title: 'Legacy', artist: 'Artist' }];
    await AsyncStorage.setItem(legacySongsKey, JSON.stringify(songs));
    await storage.get(StorageKeys.SONGS);
    const chunkKey = (await AsyncStorage.getAllKeys()).find(key => key.startsWith(SONG_LIBRARY_CHUNK_PREFIX));
    expect(chunkKey).toBeDefined();
    await AsyncStorage.setItem(chunkKey!, 'corrupt');

    await expect(storage.get(StorageKeys.SONGS)).resolves.toEqual(songs);
  });

  it('never falls back to a stale legacy snapshot after a newer commit', async () => {
    const oldSongs = [{ id: 'legacy', title: 'Legacy', artist: 'Artist' }];
    const newSongs = [{ id: 'current', title: 'Current', artist: 'Artist' }];
    await AsyncStorage.setItem(legacySongsKey, JSON.stringify(oldSongs));
    await storage.get(StorageKeys.SONGS);
    jest.spyOn(AsyncStorage, 'removeItem').mockRejectedValueOnce(new Error('legacy cleanup failed'));

    await storage.set(StorageKeys.SONGS, newSongs);
    const manifest = JSON.parse((await AsyncStorage.getItem(SONG_LIBRARY_MANIFEST_KEY))!);
    await AsyncStorage.setItem(manifest.chunks[0].key, 'corrupt');

    await expect(storage.get(StorageKeys.SONGS)).rejects.toBeInstanceOf(StorageOperationError);
  });

  it('fails loudly for corruption when no legacy rollback copy exists', async () => {
    await storage.set(StorageKeys.SONGS, [{ id: 'current', title: 'Current', artist: 'Artist' }]);
    const chunkKey = (await AsyncStorage.getAllKeys()).find(key => key.startsWith(SONG_LIBRARY_CHUNK_PREFIX));
    expect(chunkKey).toBeDefined();
    await AsyncStorage.setItem(chunkKey!, 'corrupt');

    await expect(storage.get(StorageKeys.SONGS)).rejects.toBeInstanceOf(StorageOperationError);
  });

  it('removes manifest, chunks, and a remaining legacy rollback copy', async () => {
    await AsyncStorage.setItem(legacySongsKey, JSON.stringify([{ id: 'legacy', title: 'Legacy', artist: 'Artist' }]));
    await storage.get(StorageKeys.SONGS);

    await storage.remove(StorageKeys.SONGS);

    const keys = await AsyncStorage.getAllKeys();
    expect(keys).not.toContain(legacySongsKey);
    expect(keys).not.toContain(SONG_LIBRARY_MANIFEST_KEY);
    expect(keys.some(key => key.startsWith(SONG_LIBRARY_CHUNK_PREFIX))).toBe(false);
  });
});
