import { waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { cacheBase64Cover, isBase64ImageDataUri, sanitizeSongsForStorage } from '../coverCache';
import { cleanupCoverCache } from '../coverCacheCleanup';
import * as coverCacheCleanup from '../coverCacheCleanup';
import type { Song } from '../../types/Song';
import { StorageKeys, storage } from '../storage';

jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///docs/',
  EncodingType: { Base64: 'base64' },
  makeDirectoryAsync: jest.fn(async () => undefined),
  writeAsStringAsync: jest.fn(async () => undefined),
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  readDirectoryAsync: jest.fn(async () => []),
  deleteAsync: jest.fn(async () => undefined),
}));


type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

const createDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => {
    resolve = res;
  });
  return { promise, resolve };
};

const hashForTest = (value: string): string => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
};

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///docs/',
  EncodingType: { Base64: 'base64' },
  makeDirectoryAsync: jest.fn(async () => undefined),
  writeAsStringAsync: jest.fn(async () => undefined),
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  readDirectoryAsync: jest.fn(async () => []),
  deleteAsync: jest.fn(async () => undefined),
}));

describe('coverCache', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    coverCacheCleanup.invalidateCoverCacheCleanup();
    jest.clearAllMocks();
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
    (LegacyFileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
    (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([]);
    (LegacyFileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([]);
  });

  test('detects image base64 data uri', () => {
    expect(isBase64ImageDataUri('data:image/png;base64,AAA=')).toBe(true);
    expect(isBase64ImageDataUri('file:///cache/covers/a.png')).toBe(false);
    expect(isBase64ImageDataUri(undefined)).toBe(false);
  });

  test('migrates base64 covers to local file URIs', async () => {
    const songs: Song[] = [
      { id: '1', title: 'A', artist: 'X', cover: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD' },
      { id: '2', title: 'B', artist: 'Y', cover: 'file:///cache/covers/2.jpg' },
    ];

    const result = await sanitizeSongsForStorage(songs);
    expect(result[0].cover).toMatch(/^file:\/\/\/docs\/covers\/.+\.jpg$/);
    expect(result[1].cover).toBe('file:///cache/covers/2.jpg');
    expect(result[0].cover?.startsWith('data:image/')).toBe(false);

    expect(LegacyFileSystem.makeDirectoryAsync).toHaveBeenCalledWith('file:///docs/covers', {
      intermediates: true,
    });
    expect(LegacyFileSystem.writeAsStringAsync).toHaveBeenCalled();
  });

  test('cacheBase64Cover returns existing non-base64 URIs unchanged', async () => {
    await expect(cacheBase64Cover('x', 'file:///my.jpg')).resolves.toBe('file:///my.jpg');
  });

  test('reuses existing cached file without rewriting', async () => {
    (LegacyFileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({ exists: true });
    const cached = await cacheBase64Cover('reuse-1', 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD');
    expect(cached).toMatch(/^file:\/\/\/docs\/covers\/.+\.jpg$/);
    expect(LegacyFileSystem.writeAsStringAsync).not.toHaveBeenCalled();
  });

  test('strips embedded base64 cover when file write fails', async () => {
    (LegacyFileSystem.writeAsStringAsync as jest.Mock).mockRejectedValueOnce(new Error('write rejected'));
    const originalCover = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
    const songs: Song[] = [
      {
        id: 'fail-1',
        title: 'A',
        artist: 'B',
        cover: originalCover,
        coverInfo: { status: 'embedded', uri: originalCover },
      },
    ];

    const result = await sanitizeSongsForStorage(songs);

    expect(result[0].cover).toBeUndefined();
    expect(result[0].coverInfo).toEqual({ status: 'none' });
  });

  test('strips invalid embedded base64 cover during storage sanitizing', async () => {
    const songs: Song[] = [
      {
        id: 'bad-cover',
        title: 'A',
        artist: 'B',
        cover: 'data:image/jpeg;base64,??',
        coverInfo: { status: 'embedded', uri: 'data:image/jpeg;base64,??' },
      },
    ];

    const result = await sanitizeSongsForStorage(songs);

    expect(result[0].cover).toBeUndefined();
    expect(result[0].coverInfo).toEqual({ status: 'none' });
  });

  test('ignores invalid base64 payload for direct cache attempt', async () => {
    await expect(cacheBase64Cover('bad', 'data:image/jpeg;base64,??')).resolves.toBeUndefined();
  });

  test('ignores payload that does not match declared mime signature', async () => {
    await expect(cacheBase64Cover('bad-2', 'data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD')).resolves.toBeUndefined();
  });

  test('accepts unknown image subtype when bytes indicate known image format', async () => {
    const cached = await cacheBase64Cover('ok-3', 'data:image/heic;base64,/9j/4AAQSkZJRgABAQAAAQABAAD');
    expect(cached).toMatch(/^file:\/\/\/docs\/covers\/.+\.jpg$/);
  });


  test('sanitizeSongsForStorage does not trigger cover cache cleanup', async () => {
    const cleanupSpy = jest.spyOn(coverCacheCleanup, 'cleanupCoverCache');

    const result = await sanitizeSongsForStorage([{ id: 'pure-1', title: 'A', artist: 'B', cover: 'file:///docs/covers/keep.jpg' }]);

    expect(result[0].cover).toBe('file:///docs/covers/keep.jpg');
    expect(cleanupSpy).not.toHaveBeenCalled();
  });


  test('older cleanup cannot delete a newly sanitized cover before its snapshot is persisted', async () => {
    const base64 = '/9j/4AAQSkZJRgABAQAAAQABAAD';
    const songId = 'new-cover-race';
    const expectedFileName = `${hashForTest(songId)}-${hashForTest(base64)}.jpg`;
    const expectedUri = `file:///docs/covers/${expectedFileName}`;
    const cachedFiles = new Set(['aaa-bbb.jpg', expectedFileName]);
    const directoryRead = createDeferred<string[]>();

    (LegacyFileSystem.getInfoAsync as jest.Mock).mockImplementation(async (uri: string) => ({
      exists: uri === 'file:///docs/covers' || cachedFiles.has(uri.slice('file:///docs/covers/'.length)),
    }));
    (LegacyFileSystem.readDirectoryAsync as jest.Mock).mockImplementationOnce(async () => directoryRead.promise);
    (LegacyFileSystem.deleteAsync as jest.Mock).mockImplementation(async (uri: string) => {
      cachedFiles.delete(uri.slice('file:///docs/covers/'.length));
    });
    (LegacyFileSystem.writeAsStringAsync as jest.Mock).mockImplementation(async (uri: string) => {
      cachedFiles.add(uri.slice('file:///docs/covers/'.length));
    });

    const oldCleanup = cleanupCoverCache([
      { id: 'old', title: 'Old', artist: 'Artist', cover: 'file:///docs/covers/aaa-bbb.jpg' },
    ]);
    await waitFor(() => expect(LegacyFileSystem.readDirectoryAsync).toHaveBeenCalledTimes(1));

    const protection = coverCacheCleanup.beginCoverCacheProtection();
    const nextSnapshot = sanitizeSongsForStorage([
      { id: songId, title: 'New', artist: 'Artist', cover: `data:image/jpeg;base64,${base64}` },
    ]);
    await Promise.resolve();

    directoryRead.resolve(Array.from(cachedFiles));
    const sanitizedSongs = await nextSnapshot;
    await storage.set(StorageKeys.SONGS, sanitizedSongs);
    coverCacheCleanup.releaseCoverCacheProtection(protection);
    await oldCleanup;

    expect(sanitizedSongs[0].cover).toBe(expectedUri);
    await expect(storage.get<Song[]>(StorageKeys.SONGS)).resolves.toEqual([
      expect.objectContaining({ id: songId, cover: expectedUri }),
    ]);
    expect(LegacyFileSystem.deleteAsync).not.toHaveBeenCalledWith(expectedUri, expect.anything());
    expect(cachedFiles.has(expectedFileName)).toBe(true);
  });



  test('older cleanup cannot delete an existing cover reused by a pending sanitized snapshot', async () => {
    const expectedFileName = 'abc-def.jpg';
    const expectedUri = `file:///docs/covers/${expectedFileName}`;
    const cachedFiles = new Set([expectedFileName]);
    const directoryRead = createDeferred<string[]>();

    (LegacyFileSystem.getInfoAsync as jest.Mock).mockImplementation(async (uri: string) => ({
      exists: uri === 'file:///docs/covers' || cachedFiles.has(uri.slice('file:///docs/covers/'.length)),
    }));
    (LegacyFileSystem.readDirectoryAsync as jest.Mock).mockImplementationOnce(async () => directoryRead.promise);
    (LegacyFileSystem.deleteAsync as jest.Mock).mockImplementation(async (uri: string) => {
      cachedFiles.delete(uri.slice('file:///docs/covers/'.length));
    });

    const oldCleanup = cleanupCoverCache([]);
    await waitFor(() => expect(LegacyFileSystem.readDirectoryAsync).toHaveBeenCalledTimes(1));

    const pendingSongs: Song[] = [{ id: 'reuse', title: 'New', artist: 'Artist', cover: expectedUri }];
    const protection = coverCacheCleanup.beginCoverCacheProtection(pendingSongs);
    const sanitizedSongs = await sanitizeSongsForStorage(pendingSongs);
    await storage.set(StorageKeys.SONGS, sanitizedSongs);
    directoryRead.resolve(Array.from(cachedFiles));
    await oldCleanup;
    coverCacheCleanup.releaseCoverCacheProtection(protection);

    expect(sanitizedSongs[0].cover).toBe(expectedUri);
    await expect(storage.get<Song[]>(StorageKeys.SONGS)).resolves.toEqual([
      expect.objectContaining({ id: 'reuse', cover: expectedUri }),
    ]);
    expect(LegacyFileSystem.deleteAsync).not.toHaveBeenCalledWith(expectedUri, expect.anything());
    expect(cachedFiles.has(expectedFileName)).toBe(true);
  });

  test('new sanitization rewrites and persists a cover after an older cleanup delete already started', async () => {
    const base64 = '/9j/4AAQSkZJRgABAQAAAQABAAD';
    const songId = 'started-delete-race';
    const expectedFileName = `${hashForTest(songId)}-${hashForTest(base64)}.jpg`;
    const expectedUri = `file:///docs/covers/${expectedFileName}`;
    const cachedFiles = new Set([expectedFileName]);
    const deleteDeferred = createDeferred<void>();

    (LegacyFileSystem.getInfoAsync as jest.Mock).mockImplementation(async (uri: string) => ({
      exists: uri === 'file:///docs/covers' || cachedFiles.has(uri.slice('file:///docs/covers/'.length)),
    }));
    (LegacyFileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([expectedFileName]);
    (LegacyFileSystem.deleteAsync as jest.Mock).mockImplementationOnce(async (uri: string) => {
      await deleteDeferred.promise;
      cachedFiles.delete(uri.slice('file:///docs/covers/'.length));
    });
    (LegacyFileSystem.writeAsStringAsync as jest.Mock).mockImplementation(async (uri: string) => {
      cachedFiles.add(uri.slice('file:///docs/covers/'.length));
    });

    const oldCleanup = cleanupCoverCache([]);
    await waitFor(() => expect(LegacyFileSystem.deleteAsync).toHaveBeenCalledWith(expectedUri, { idempotent: true }));

    const protection = coverCacheCleanup.beginCoverCacheProtection();
    const nextSnapshot = sanitizeSongsForStorage([
      { id: songId, title: 'New', artist: 'Artist', cover: `data:image/jpeg;base64,${base64}` },
    ]);
    deleteDeferred.resolve(undefined);

    const sanitizedSongs = await nextSnapshot;
    await storage.set(StorageKeys.SONGS, sanitizedSongs);
    coverCacheCleanup.releaseCoverCacheProtection(protection);
    await oldCleanup;

    expect(LegacyFileSystem.writeAsStringAsync).toHaveBeenCalledWith(expectedUri, base64, { encoding: 'base64' });
    await expect(storage.get<Song[]>(StorageKeys.SONGS)).resolves.toEqual([
      expect.objectContaining({ id: songId, cover: expectedUri }),
    ]);
    expect(cachedFiles.has(expectedFileName)).toBe(true);
  });
  test('sanitizeSongsForStorage preserves track/disc/comment fields', async () => {
    const songs: Song[] = [
      {
        id: 'meta-1',
        title: 'A',
        artist: 'B',
        trackNumber: '5/10',
        discNumber: '1/2',
        comment: 'Keep me',
        cover: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD',
      },
    ];

    const result = await sanitizeSongsForStorage(songs);
    expect(result[0].trackNumber).toBe('5/10');
    expect(result[0].discNumber).toBe('1/2');
    expect(result[0].comment).toBe('Keep me');
  });

  test('cleans orphaned cached cover files', async () => {
    (LegacyFileSystem.getInfoAsync as jest.Mock).mockImplementation(async (uri: string) => ({
      exists: uri === 'file:///docs/covers' || uri.includes('aaa-bbb.jpg'),
    }));
    (LegacyFileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(['aaa-bbb.jpg', 'ccc-ddd.jpg']);

    await cleanupCoverCache([
      { id: 'keep', title: 'A', artist: 'B', cover: 'file:///docs/covers/aaa-bbb.jpg' },
    ]);

    expect(LegacyFileSystem.deleteAsync).toHaveBeenCalledWith('file:///docs/covers/ccc-ddd.jpg', {
      idempotent: true,
    });
    expect(LegacyFileSystem.deleteAsync).not.toHaveBeenCalledWith('file:///docs/covers/aaa-bbb.jpg', expect.anything());
  });

  test('ignores cleanup failures', async () => {
    (LegacyFileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
    (LegacyFileSystem.readDirectoryAsync as jest.Mock).mockRejectedValueOnce(new Error('no access'));

    await expect(cleanupCoverCache([])).resolves.toBeUndefined();
  });
});