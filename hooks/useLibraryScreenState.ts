import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { LibraryAlbumViewMode } from '../components/LibraryAlbumViewToggle';
import type { LibraryTab } from '../utils/libraryTabs';
import { storage } from '../utils/storage';
import { DEFAULT_LIBRARY_ALBUM_VIEW_MODE } from '../utils/libraryViewMode';

export interface UseLibraryScreenStateResult {
  activeTab: LibraryTab;
  albumViewMode: LibraryAlbumViewMode;
  importStatus: string | null;
  loading: boolean;
  menuOpen: boolean;
  query: string;
  searchOpen: boolean;
  setActiveTab: Dispatch<SetStateAction<LibraryTab>>;
  setAlbumViewMode: Dispatch<SetStateAction<LibraryAlbumViewMode>>;
  setImportStatus: Dispatch<SetStateAction<string | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setMenuOpen: Dispatch<SetStateAction<boolean>>;
  setQuery: Dispatch<SetStateAction<string>>;
  setSearchOpen: Dispatch<SetStateAction<boolean>>;
}

export const useLibraryScreenState = (): UseLibraryScreenStateResult => {
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<LibraryTab>('tracks');
  const [albumViewMode, setAlbumViewMode] = useState<LibraryAlbumViewMode>(DEFAULT_LIBRARY_ALBUM_VIEW_MODE);

  // Restore the persisted album view after a restart, then persist on change.
  const albumViewHydratedRef = useRef(false);
  useEffect(() => {
    let active = true;
    void storage.getAlbumViewMode().then(stored => {
      if (!active) return;
      albumViewHydratedRef.current = true;
      setAlbumViewMode(stored);
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!albumViewHydratedRef.current) return;
    void storage.setAlbumViewMode(albumViewMode);
  }, [albumViewMode]);

  return {
    activeTab,
    albumViewMode,
    importStatus,
    loading,
    menuOpen,
    query,
    searchOpen,
    setActiveTab,
    setAlbumViewMode,
    setImportStatus,
    setLoading,
    setMenuOpen,
    setQuery,
    setSearchOpen,
  };
};
