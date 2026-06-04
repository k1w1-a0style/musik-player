import * as LegacyFileSystem from 'expo-file-system/legacy';
import {
  cleanupCoverCache,
  invalidateCoverCacheCleanup,
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

  test('cleanup delete errors resolve without unhandled rejection', async () => {
    const unhandled = jest.fn();
    process.once('unhandledRejection', unhandled);
    (LegacyFileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(['aaa-bbb.jpg']);
    (LegacyFileSystem.deleteAsync as jest.Mock).mockRejectedValueOnce(new Error('delete failed'));

    await expect(cleanupCoverCache([])).resolves.toBeUndefined();
    await new Promise(resolve => setImmediate(resolve));

    expect(unhandled).not.toHaveBeenCalled();
    process.removeListener('unhandledRejection', unhandled);
  });

  test('does nothing when cache directory is missing', async () => {
    (LegacyFileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

    await cleanupCoverCache([]);

    expect(LegacyFileSystem.readDirectoryAsync).not.toHaveBeenCalled();
    expect(LegacyFileSystem.deleteAsync).not.toHaveBeenCalled();
  });
});
