import type { ScanFolder } from '../types/ScanFolder';
import { getFavoriteSongIds, getScanFolders } from './storage';

interface LibraryStorageLoaderDependencies {
  getScanFoldersImpl?: typeof getScanFolders;
  getFavoriteSongIdsImpl?: typeof getFavoriteSongIds;
}

interface LibraryStartupState {
  scanFolders: ScanFolder[];
  favoriteIds: string[];
}

const getFallbackValue = async <T>(loader: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await loader();
  } catch {
    return fallback;
  }
};

export const loadFavoriteSongIds = async (
  dependencies: LibraryStorageLoaderDependencies = {},
): Promise<string[]> => {
  const getFavoriteSongIdsImpl = dependencies.getFavoriteSongIdsImpl ?? getFavoriteSongIds;

  return getFallbackValue(getFavoriteSongIdsImpl, []);
};

export const loadLibraryStartupState = async (
  dependencies: LibraryStorageLoaderDependencies = {},
): Promise<LibraryStartupState> => {
  const getScanFoldersImpl = dependencies.getScanFoldersImpl ?? getScanFolders;

  const [scanFolders, favoriteIds] = await Promise.all([
    getFallbackValue(getScanFoldersImpl, []),
    loadFavoriteSongIds(dependencies),
  ]);

  return { scanFolders, favoriteIds };
};
