import { loadFavoriteSongIds, loadLibraryStartupState } from '../libraryStorageLoaders';
import type { ScanFolder } from '../../types/ScanFolder';

const folder = (id: string): ScanFolder => ({
  id,
  name: id,
  uri: `content://${id}`,
  addedAt: 1,
  enabled: true,
});

test('loadFavoriteSongIds returns favorite ids', async () => {
  await expect(loadFavoriteSongIds({ getFavoriteSongIdsImpl: jest.fn().mockResolvedValue(['a', 'b']) })).resolves.toEqual(['a', 'b']);
});

test('loadFavoriteSongIds returns fallback when storage fails', async () => {
  await expect(loadFavoriteSongIds({ getFavoriteSongIdsImpl: jest.fn().mockRejectedValue(new Error('boom')) })).resolves.toEqual([]);
});

test('loadLibraryStartupState returns scan folders and favorite ids', async () => {
  const scanFolders = [folder('music')];
  const favoriteIds = ['song-1'];

  await expect(
    loadLibraryStartupState({
      getScanFoldersImpl: jest.fn().mockResolvedValue(scanFolders),
      getFavoriteSongIdsImpl: jest.fn().mockResolvedValue(favoriteIds),
    }),
  ).resolves.toEqual({ scanFolders, favoriteIds });
});

test('loadLibraryStartupState returns fallbacks when storage fails', async () => {
  await expect(
    loadLibraryStartupState({
      getScanFoldersImpl: jest.fn().mockRejectedValue(new Error('folders failed')),
      getFavoriteSongIdsImpl: jest.fn().mockRejectedValue(new Error('favorites failed')),
    }),
  ).resolves.toEqual({ scanFolders: [], favoriteIds: [] });
});
