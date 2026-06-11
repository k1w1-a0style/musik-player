import { waitFor } from '@testing-library/react-native';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import {
  createCoverCacheProtection,
  cleanupCoverCache,
  invalidateCoverCacheCleanup,
  waitForCoverCacheCleanupIdle,
  getCoverCacheDirectory,
  isSafeCoverCacheFileName,
} from '../coverCacheCleanup';

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///fallback-docs/',
  cacheDirectory: 'file:///fallback-cache/',
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  cacheDirectory: 'file:///cache/',
  getInfoAsync: jest.fn(async () => ({ exists: true })),
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

describe('coverCacheCleanup', () => {
  beforeEach(() => {
    invalidateCoverCacheCleanup();
    jest.clearAllMocks();
    (LegacyFileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
    (LegacyFileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([]);
  });

  test('builds cover cache directory from legacy document directory', () => {
    expect(getCoverCacheDirectory()).toBe('file:///docs/covers');
  });

  test('accepts only generated cover cache file names', () => {
    expect(isSafeCoverCacheFileName('abc123-def456.jpg')).toBe(true);
    expect(isSafeCoverCacheFileName('abc123-def456.jpeg')).toBe(true);
    expect(isSafeCoverCacheFileName('abc123-def456.png')).toBe(true);
    expect(isSafeCoverCacheFileName('abc123-def456.webp')).toBe(true);
    expect(isSafeCoverCacheFileName('../escape.jpg')).toBe(false);
    expect(isSafeCoverCacheFileName('nested/escape.jpg')).toBe(false);
    expect(isSafeCoverCacheFileName('abc123-def456.txt')).toBe(false);
    expect(isSafeCoverCacheFileName('cover.jpg')).toBe(false);
  });

  test('deletes only safe orphaned cache files', async () => {
    (LegacyFileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
      'aaa-bbb.jpg',
      'ccc-ddd.png',
      '../escape.jpg',
      'nested/escape.jpg',
      'cover.jpg',
      'notes.txt',
    ]);

    await cleanupCoverCache([
      { id: 'keep', title: 'Keep', artist: 'Artist', cover: 'file:///docs/covers/aaa-bbb.jpg' },
    ]);

    expect(LegacyFileSystem.deleteAsync).toHaveBeenCalledWith('file:///docs/covers/ccc-ddd.png', {
      idempotent: true,
    });
    expect(LegacyFileSystem.deleteAsync).toHaveBeenCalledTimes(1);
  });

  test('keeps safe referenced coverInfo uri even when cover is absent', async () => {
    (LegacyFileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(['aaa-bbb.jpg', 'ccc-ddd.png']);

    await cleanupCoverCache([
      {
        id: 'keep-info',
        title: 'Keep Info',
        artist: 'Artist',
        coverInfo: { status: 'cached', uri: 'file:///docs/covers/ccc-ddd.png' },
      },
    ]);

    expect(LegacyFileSystem.deleteAsync).toHaveBeenCalledWith('file:///docs/covers/aaa-bbb.jpg', {
      idempotent: true,
    });
    expect(LegacyFileSystem.deleteAsync).not.toHaveBeenCalledWith('file:///docs/covers/ccc-ddd.png', expect.anything());
  });

  test('two quickly scheduled cleanups only delete from latest snapshot', async () => {
    (LegacyFileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(['aaa-bbb.jpg', 'ccc-ddd.jpg']);

    const first = cleanupCoverCache([
      { id: 'old', title: 'Old', artist: 'Artist', cover: 'file:///docs/covers/aaa-bbb.jpg' },
    ]);
    const second = cleanupCoverCache([
      { id: 'new', title: 'New', artist: 'Artist', cover: 'file:///docs/covers/ccc-ddd.jpg' },
    ]);

    await Promise.all([first, second]);

    expect(LegacyFileSystem.deleteAsync).toHaveBeenCalledWith('file:///docs/covers/aaa-bbb.jpg', {
      idempotent: true,
    });
    expect(LegacyFileSystem.deleteAsync).not.toHaveBeenCalledWith('file:///docs/covers/ccc-ddd.jpg', expect.anything());
    expect(LegacyFileSystem.readDirectoryAsync).toHaveBeenCalledTimes(1);
  });

  test('keeps dynamically protected in-flight cover files out of an older cleanup delete batch', async () => {
    const directoryRead = createDeferred<string[]>();
    (LegacyFileSystem.readDirectoryAsync as jest.Mock).mockImplementationOnce(async () => directoryRead.promise);

    const staleCleanup = cleanupCoverCache([
      { id: 'old', title: 'Old', artist: 'Artist', cover: 'file:///docs/covers/aaa-bbb.jpg' },
    ]);
    await waitFor(() => expect(LegacyFileSystem.readDirectoryAsync).toHaveBeenCalledTimes(1));

    const protection = createCoverCacheProtection();
    protection.protectUri('file:///docs/covers/ccc-ddd.jpg');
    directoryRead.resolve(['aaa-bbb.jpg', 'ccc-ddd.jpg']);
    await staleCleanup;

    expect(LegacyFileSystem.deleteAsync).not.toHaveBeenCalledWith('file:///docs/covers/ccc-ddd.jpg', expect.anything());
    expect(LegacyFileSystem.deleteAsync).not.toHaveBeenCalled();
    protection.release();
  });

  test('rechecks pending protection immediately before each delete', async () => {
    const firstDelete = createDeferred<void>();
    (LegacyFileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(['aaa-bbb.jpg', 'ccc-ddd.jpg']);
    (LegacyFileSystem.deleteAsync as jest.Mock).mockImplementationOnce(async () => firstDelete.promise);

    const cleanup = cleanupCoverCache([]);
    await waitFor(() => expect(LegacyFileSystem.deleteAsync).toHaveBeenCalledWith('file:///docs/covers/aaa-bbb.jpg', {
      idempotent: true,
    }));

    const protection = createCoverCacheProtection();
    protection.protectSongCovers([
      { id: 'pending', title: 'Pending', artist: 'Artist', cover: 'file:///docs/covers/ccc-ddd.jpg' },
    ]);
    firstDelete.resolve(undefined);
    await cleanup;

    expect(LegacyFileSystem.deleteAsync).not.toHaveBeenCalledWith('file:///docs/covers/ccc-ddd.jpg', expect.anything());
    protection.release();
  });

  test('keeps a shared cover protected until every owning persistence round releases it', async () => {
    const pendingSongs = [
      { id: 'pending', title: 'Pending', artist: 'Artist', cover: 'file:///docs/covers/ccc-ddd.jpg' },
    ];
    const firstProtection = createCoverCacheProtection();
    const secondProtection = createCoverCacheProtection();
    firstProtection.protectSongCovers(pendingSongs);
    secondProtection.protectSongCovers(pendingSongs);
    (LegacyFileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(['ccc-ddd.jpg']);

    firstProtection.release();
    await cleanupCoverCache([]);
    expect(LegacyFileSystem.deleteAsync).not.toHaveBeenCalled();

    secondProtection.release();
    await cleanupCoverCache([]);
    expect(LegacyFileSystem.deleteAsync).toHaveBeenCalledWith('file:///docs/covers/ccc-ddd.jpg', {
      idempotent: true,
    });
  });

  test('replaces a hydration protection with kept song covers so dropped covers can be deleted', async () => {
    const protection = createCoverCacheProtection();
    protection.protectSongCovers([
      { id: 'keep', title: 'Keep', artist: 'Artist', cover: 'file:///docs/covers/aaa-bbb.jpg' },
      { id: 'drop', title: 'Drop', artist: 'Artist', cover: 'file:///docs/covers/ccc-ddd.jpg' },
    ]);
    protection.replaceProtectedSongCovers([
      { id: 'keep', title: 'Keep', artist: 'Artist', cover: 'file:///docs/covers/aaa-bbb.jpg' },
    ]);
    (LegacyFileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(['aaa-bbb.jpg', 'ccc-ddd.jpg']);

    await cleanupCoverCache([
      { id: 'keep', title: 'Keep', artist: 'Artist', cover: 'file:///docs/covers/aaa-bbb.jpg' },
    ]);

    expect(LegacyFileSystem.deleteAsync).not.toHaveBeenCalledWith('file:///docs/covers/aaa-bbb.jpg', expect.anything());
    expect(LegacyFileSystem.deleteAsync).toHaveBeenCalledWith('file:///docs/covers/ccc-ddd.jpg', {
      idempotent: true,
    });
    protection.release();
  });

  test('protects safe cache file names with query or fragment but ignores external and unsafe paths', async () => {
    const protection = createCoverCacheProtection();
    protection.protectUri('file:///docs/covers/ccc-ddd.jpg?version=2#cover');
    protection.protectUri('file:///elsewhere/eee-fff.jpg');
    protection.protectUri('file:///docs/covers/../escape.jpg');
    (LegacyFileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
      'ccc-ddd.jpg',
      'eee-fff.jpg',
      'aaa-bbb.jpg',
    ]);

    await cleanupCoverCache([]);

    expect(LegacyFileSystem.deleteAsync).not.toHaveBeenCalledWith('file:///docs/covers/ccc-ddd.jpg', expect.anything());
    expect(LegacyFileSystem.deleteAsync).toHaveBeenCalledWith('file:///docs/covers/eee-fff.jpg', { idempotent: true });
    expect(LegacyFileSystem.deleteAsync).toHaveBeenCalledWith('file:///docs/covers/aaa-bbb.jpg', { idempotent: true });
    protection.release();
  });

  test('waits for an already-started cleanup delete before continuing cover cache writes', async () => {
    const deleteDeferred = createDeferred<void>();
    let idleSettled = false;
    (LegacyFileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(['ccc-ddd.jpg']);
    (LegacyFileSystem.deleteAsync as jest.Mock).mockImplementationOnce(async () => deleteDeferred.promise);

    const cleanup = cleanupCoverCache([]);
    await waitFor(() => expect(LegacyFileSystem.deleteAsync).toHaveBeenCalledWith('file:///docs/covers/ccc-ddd.jpg', {
      idempotent: true,
    }));

    const idle = waitForCoverCacheCleanupIdle().then(() => {
      idleSettled = true;
    });
    await Promise.resolve();
    expect(idleSettled).toBe(false);

    deleteDeferred.resolve(undefined);
    await Promise.all([cleanup, idle]);
    expect(idleSettled).toBe(true);
  });

  test('invalidating cleanup skips stale deletions before a newer persistence round commits', async () => {
    (LegacyFileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(['aaa-bbb.jpg', 'ccc-ddd.jpg']);

    const staleCleanup = cleanupCoverCache([
      { id: 'old', title: 'Old', artist: 'Artist', cover: 'file:///docs/covers/aaa-bbb.jpg' },
    ]);
    invalidateCoverCacheCleanup();

    await staleCleanup;

    expect(LegacyFileSystem.deleteAsync).not.toHaveBeenCalled();
    expect(LegacyFileSystem.readDirectoryAsync).not.toHaveBeenCalled();
  });

  test('cleanup delete errors resolve without unhandled rejection and log sanitized warning', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const unhandled = jest.fn();
    process.once('unhandledRejection', unhandled);
    (LegacyFileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(['aaa-bbb.jpg']);
    (LegacyFileSystem.deleteAsync as jest.Mock).mockRejectedValueOnce(new Error('delete failed'));

    await expect(cleanupCoverCache([])).resolves.toBeUndefined();
    await new Promise(resolve => setImmediate(resolve));

    expect(unhandled).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      '[CoverCacheCleanup]',
      'Best-effort cleanup failed; cache state was left unchanged.',
      'delete failed',
    );
    expect(warnSpy.mock.calls.flat().join(' ')).not.toContain('file:///docs/covers/aaa-bbb.jpg');
    process.removeListener('unhandledRejection', unhandled);
    warnSpy.mockRestore();
  });

  test('does nothing when cache directory is missing', async () => {
    (LegacyFileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

    await cleanupCoverCache([]);

    expect(LegacyFileSystem.readDirectoryAsync).not.toHaveBeenCalled();
    expect(LegacyFileSystem.deleteAsync).not.toHaveBeenCalled();
  });
});
