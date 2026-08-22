import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ScanFolder } from '../types/ScanFolder';
import type { LibraryTab } from '../utils/libraryTabs';
import { loadFavoriteSongIds, loadLibraryStartupState } from '../utils/libraryStorageLoaders';
import {
  getFavoriteSongIdsRevision,
  getPublishedFavoriteSongIds,
  subscribeFavoriteSongIds,
} from '../utils/favoriteSongState';

export interface UseLibraryStoredStateResult {
  scanFolders: ScanFolder[];
  setScanFolders: Dispatch<SetStateAction<ScanFolder[]>>;
  favoriteIds: string[];
  setFavoriteIds: Dispatch<SetStateAction<string[]>>;
}

export const useLibraryStoredState = (activeTab: LibraryTab): UseLibraryStoredStateResult => {
  const [scanFolders, setScanFolders] = useState<ScanFolder[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(
    () => [...(getPublishedFavoriteSongIds() ?? [])],
  );

  useEffect(() => {
    let mounted = true;
    const favoriteRevision = getFavoriteSongIdsRevision();

    loadLibraryStartupState().then(state => {
      if (!mounted) return;
      setScanFolders(state.scanFolders);
      if (getFavoriteSongIdsRevision() === favoriteRevision) setFavoriteIds(state.favoriteIds);
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => subscribeFavoriteSongIds(ids => setFavoriteIds([...ids])), []);

  useEffect(() => {
    if (activeTab !== 'favorites') return;
    let mounted = true;
    const favoriteRevision = getFavoriteSongIdsRevision();

    loadFavoriteSongIds().then(ids => {
      if (mounted && getFavoriteSongIdsRevision() === favoriteRevision) setFavoriteIds(ids);
    });

    return () => {
      mounted = false;
    };
  }, [activeTab]);

  return {
    scanFolders,
    setScanFolders,
    favoriteIds,
    setFavoriteIds,
  };
};
