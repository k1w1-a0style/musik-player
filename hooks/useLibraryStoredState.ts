import { useEffect, useState } from 'react';
import type { ScanFolder } from '../types/ScanFolder';
import type { LibraryTab } from '../utils/libraryTabs';
import { loadFavoriteSongIds, loadLibraryStartupState } from '../utils/libraryStorageLoaders';

interface UseLibraryStoredStateResult {
  scanFolders: ScanFolder[];
  setScanFolders: React.Dispatch<React.SetStateAction<ScanFolder[]>>;
  favoriteIds: string[];
  setFavoriteIds: React.Dispatch<React.SetStateAction<string[]>>;
}

export const useLibraryStoredState = (activeTab: LibraryTab): UseLibraryStoredStateResult => {
  const [scanFolders, setScanFolders] = useState<ScanFolder[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;

    loadLibraryStartupState().then(state => {
      if (!mounted) return;
      setScanFolders(state.scanFolders);
      setFavoriteIds(state.favoriteIds);
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'favorites') return;
    let mounted = true;

    loadFavoriteSongIds().then(ids => {
      if (mounted) setFavoriteIds(ids);
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
