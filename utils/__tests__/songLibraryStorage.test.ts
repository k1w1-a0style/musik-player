import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageKeys, StorageOperationError, storage } from '../storage';
import {
  MAX_SONG_LIBRARY_CHUNK_CODE_UNITS,
  readStoredSongLibrary,
  resetSongLibraryStorageForTests,
  SONG_LIBRARY_CHUNK_PREFIX,
  SONG_LIBRARY_MANIFEST_KEY,
  writeStoredSongLibrary,
} from '../songLibraryStorage';
import { hashString128 } from '../stringHash';

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

  it('reads an existing offset-chunk v2 manifest without changing song order or IDs', async () => {
    const serialized = JSON.stringify([{ id: 'old-format', title: 'a'.repeat(MAX_SONG_LIBRARY_CHUNK_CODE_UNITS), artist: 'Artist' }]);
    const chunks: string[] = [];
    for (let offset = 0; offset < serialized.length; offset += MAX_SONG_LIBRARY_CHUNK_CODE_UNITS) {
      chunks.push(serialized.slice(offset, offset + MAX_SONG_LIBRARY_CHUNK_CODE_UNITS));
    }
    const references = chunks.map(value => ({
      key: `${SONG_LIBRARY_CHUNK_PREFIX}${hashString128(value)}`,
      length: value.length, checksum: hashString128(value),
    }));
    await AsyncStorage.multiSet(references.map((reference, index) => [reference.key, chunks[index]]));
    await AsyncStorage.setItem(SONG_LIBRARY_MANIFEST_KEY, JSON.stringify({
      version: 2, revision: 'old-revision', serializedLength: serialized.length,
      checksum: hashString128(serialized), chunks: references,
    }));
    resetSongLibraryStorageForTests();
    await expect(readStoredSongLibrary(legacySongsKey)).resolves.toEqual({ source: 'chunked', serialized });
  });

  it('reuses later song chunks when an earlier song is inserted, edited, or removed', async () => {
    const songs = Array.from({ length: 2000 }, (_, index) => ({
      id: `song-${index}`, title: `${index}-${'x'.repeat(500)}`, artist: 'Artist', uri: `file:///${index}.mp3`,
    }));
    await storage.set(StorageKeys.SONGS, songs);
    const originalManifest = JSON.parse((await AsyncStorage.getItem(SONG_LIBRARY_MANIFEST_KEY))!);
    const originalKeys = new Set(originalManifest.chunks.map((chunk: { key: string }) => chunk.key));
    const inserted = [{ id: 'inserted', title: 'New first song', artist: 'Artist', uri: 'file:///new.mp3' }, ...songs];
    (AsyncStorage.multiSet as jest.Mock).mockClear();
    await storage.set(StorageKeys.SONGS, inserted);
    const insertedManifest = JSON.parse((await AsyncStorage.getItem(SONG_LIBRARY_MANIFEST_KEY))!);
    const reused = insertedManifest.chunks.filter((chunk: { key: string }) => originalKeys.has(chunk.key));
    const writes = (AsyncStorage.multiSet as jest.Mock).mock.calls.flatMap(([pairs]) => pairs as Array<[string, string]>);
    const writtenLength = writes.reduce((total, [, value]) => total + value.length, 0);
    expect(reused.length).toBeGreaterThan(originalKeys.size / 2);
    expect(writtenLength).toBeLessThan(JSON.stringify(inserted).length / 4);
    resetSongLibraryStorageForTests();
    await expect(storage.get(StorageKeys.SONGS)).resolves.toEqual(inserted);

    const edited = inserted.map(song => song.id === 'song-1000' ? { ...song, title: 'Changed tag' } : song);
    (AsyncStorage.multiSet as jest.Mock).mockClear();
    await storage.set(StorageKeys.SONGS, edited);
    const editWrites = (AsyncStorage.multiSet as jest.Mock).mock.calls.flatMap(([pairs]) => pairs as Array<[string, string]>);
    expect(editWrites.reduce((total, [, value]) => total + value.length, 0)).toBeLessThan(JSON.stringify(edited).length / 4);
    await expect(storage.get(StorageKeys.SONGS)).resolves.toEqual(edited);

    (AsyncStorage.multiSet as jest.Mock).mockClear();
    await storage.set(StorageKeys.SONGS, songs);
    const removalWrites = (AsyncStorage.multiSet as jest.Mock).mock.calls.flatMap(([pairs]) => pairs as Array<[string, string]>);
    expect(removalWrites.reduce((total, [, value]) => total + value.length, 0)).toBeLessThan(JSON.stringify(songs).length / 4);
    await expect(storage.get(StorageKeys.SONGS)).resolves.toEqual(songs);
  });

  it('verifies unchanged content once without rewriting it', async () => {
    const serialized = JSON.stringify([{ id: 'same', title: 'Same', artist: 'Artist' }]);
    await writeStoredSongLibrary(legacySongsKey, serialized);
    (AsyncStorage.multiSet as jest.Mock).mockClear();
    (AsyncStorage.multiGet as jest.Mock).mockClear();
    await writeStoredSongLibrary(legacySongsKey, serialized);
    expect(AsyncStorage.multiSet).not.toHaveBeenCalled();
    expect(AsyncStorage.multiGet).toHaveBeenCalledTimes(1);
    await expect(readStoredSongLibrary(legacySongsKey)).resolves.toEqual({ source: 'chunked', serialized });
  });

  it('never commits a manifest when newly written chunks fail readback', async () => {
    const oldSerialized = JSON.stringify([{ id: 'old', title: 'Old' }]);
    const replacement = JSON.stringify([{ id: 'new', title: 'New' }]);
    await writeStoredSongLibrary(legacySongsKey, oldSerialized);
    const oldManifest = await AsyncStorage.getItem(SONG_LIBRARY_MANIFEST_KEY);
    jest.spyOn(AsyncStorage, 'multiSet').mockResolvedValueOnce(undefined);
    await expect(writeStoredSongLibrary(legacySongsKey, replacement)).rejects.toThrow('could not be verified');
    await expect(AsyncStorage.getItem(SONG_LIBRARY_MANIFEST_KEY)).resolves.toBe(oldManifest);
    await expect(readStoredSongLibrary(legacySongsKey)).resolves.toEqual({ source: 'chunked', serialized: oldSerialized });
  });

  it('preserves the old commit and retries orphan chunks after a manifest write failure', async () => {
    const oldSerialized = JSON.stringify([{ id: 'old', title: 'Old' }]);
    const replacement = JSON.stringify([{ id: 'new', title: 'New' }]);
    await writeStoredSongLibrary(legacySongsKey, oldSerialized);
    const oldManifest = await AsyncStorage.getItem(SONG_LIBRARY_MANIFEST_KEY);
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('manifest busy'));
    await expect(writeStoredSongLibrary(legacySongsKey, replacement)).rejects.toThrow('manifest busy');
    await expect(AsyncStorage.getItem(SONG_LIBRARY_MANIFEST_KEY)).resolves.toBe(oldManifest);
    await expect(readStoredSongLibrary(legacySongsKey)).resolves.toEqual({ source: 'chunked', serialized: oldSerialized });
    await writeStoredSongLibrary(legacySongsKey, replacement);
    await expect(readStoredSongLibrary(legacySongsKey)).resolves.toEqual({ source: 'chunked', serialized: replacement });
    const committed = JSON.parse((await AsyncStorage.getItem(SONG_LIBRARY_MANIFEST_KEY))!);
    const active = new Set(committed.chunks.map((chunk: { key: string }) => chunk.key));
    expect((await AsyncStorage.getAllKeys()).filter(key => key.startsWith(SONG_LIBRARY_CHUNK_PREFIX)))
      .toEqual(expect.arrayContaining([...active]));
    expect((await AsyncStorage.getAllKeys()).filter(key => key.startsWith(SONG_LIBRARY_CHUNK_PREFIX))).toHaveLength(active.size);
  });

  it.each(['not valid JSON {,}', '{"nonArray":true}', '[{"id":"a","nested":["comma, bracket]","escaped\\\"quote"]},null,2]', ''])(
    'round-trips arbitrary legacy serialized values verbatim: %s',
    async serialized => {
      await writeStoredSongLibrary(legacySongsKey, serialized);
      await expect(readStoredSongLibrary(legacySongsKey)).resolves.toEqual({ source: 'chunked', serialized });
    },
  );

  it('keeps very large records bounded without splitting Unicode surrogate pairs', async () => {
    const serialized = `${'x'.repeat(MAX_SONG_LIBRARY_CHUNK_CODE_UNITS - 1)}😀${'z'.repeat(MAX_SONG_LIBRARY_CHUNK_CODE_UNITS + 10)}`;
    await writeStoredSongLibrary(legacySongsKey, serialized);
    const manifest = JSON.parse((await AsyncStorage.getItem(SONG_LIBRARY_MANIFEST_KEY))!);
    const chunks = new Map(await AsyncStorage.multiGet(manifest.chunks.map((chunk: { key: string }) => chunk.key)));
    for (const reference of manifest.chunks) {
      const value = chunks.get(reference.key)!;
      expect(value.length).toBeLessThanOrEqual(MAX_SONG_LIBRARY_CHUNK_CODE_UNITS);
      expect(value).not.toMatch(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/);
    }
    await expect(readStoredSongLibrary(legacySongsKey)).resolves.toEqual({ source: 'chunked', serialized });
  });

  it('retries batched orphan cleanup after a failed cleanup without losing committed data', async () => {
    const oldSerialized = JSON.stringify([{ id: 'old', title: 'Old' }]);
    const currentSerialized = JSON.stringify([{ id: 'current', title: 'Current' }]);
    await writeStoredSongLibrary(legacySongsKey, oldSerialized);
    const stale = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(SONG_LIBRARY_CHUNK_PREFIX));
    jest.spyOn(AsyncStorage, 'multiRemove').mockRejectedValueOnce(new Error('cleanup busy'));
    await writeStoredSongLibrary(legacySongsKey, currentSerialized);
    await expect(readStoredSongLibrary(legacySongsKey)).resolves.toEqual({ source: 'chunked', serialized: currentSerialized });
    expect(await AsyncStorage.getAllKeys()).toEqual(expect.arrayContaining(stale));
    await writeStoredSongLibrary(legacySongsKey, currentSerialized);
    expect((await AsyncStorage.getAllKeys()).some(key => stale.includes(key))).toBe(false);
  });
});
