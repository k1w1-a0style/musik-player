import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { LibraryAlbumViewMode } from '../components/LibraryAlbumViewToggle';
import type { LibraryTab } from '../utils/libraryTabs';

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
  const [albumViewMode, setAlbumViewMode] = useState<LibraryAlbumViewMode>('grid');

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
