import type { Dispatch, SetStateAction } from 'react';
import type { Song } from '../types/Song';
import type { SongMetadataPatchesById } from '../contexts/useLibraryActions';
import type { ScanFolder } from '../types/ScanFolder';
import type { LibraryTab } from '../utils/libraryTabs';
import { useLibraryAlerts } from './useLibraryAlerts';
import { useLibraryImportActions } from './useLibraryImportActions';
import { useLibraryMenuActions } from './useLibraryMenuActions';
import { useLibraryMetadataRefreshActions } from './useLibraryMetadataRefreshActions';
import { useLibraryNavigationActions } from './useLibraryNavigationActions';
import { useLibraryScanFolderActions } from './useLibraryScanFolderActions';

export interface UseLibraryControllerActionsOptions {
  scanFolders: ScanFolder[];
  setActiveTab: Dispatch<SetStateAction<LibraryTab>>;
  setImportStatus: Dispatch<SetStateAction<string | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setMenuOpen: Dispatch<SetStateAction<boolean>>;
  setScanFolders: Dispatch<SetStateAction<ScanFolder[]>>;
  setSearchOpen: Dispatch<SetStateAction<boolean>>;
  setSongs: (songs: Song[]) => void;
  applySongMetadataPatches?: (patchesBySongId: SongMetadataPatchesById) => void;
  songs: Song[];
}

export interface UseLibraryControllerActionsResult {
  closeMenu: () => void;
  importFromDevice: () => Promise<void>;
  onAddScanFolder: () => Promise<void>;
  openMenu: () => void;
  openSettings: () => void;
  openTrackInfo: (song: Song) => void;
  refreshMetadataFromFiles: () => Promise<void>;
  removeFolder: (folder: ScanFolder) => Promise<void>;
  showScanFolders: () => void;
  toggleSearch: () => void;
}

export const useLibraryControllerActions = ({
  scanFolders,
  setActiveTab,
  setImportStatus,
  setLoading,
  setMenuOpen,
  setScanFolders,
  setSearchOpen,
  setSongs,
  applySongMetadataPatches,
  songs,
}: UseLibraryControllerActionsOptions): UseLibraryControllerActionsResult => {
  const { openTrackInfo } = useLibraryNavigationActions();
  const { showAlert } = useLibraryAlerts();

  const {
    closeMenu,
    openMenu,
    openSettings,
    toggleSearch,
  } = useLibraryMenuActions({
    setMenuOpen,
    setSearchOpen,
    showAlert,
  });

  const {
    onAddScanFolder,
    persistChangedFolderUpdates,
    removeFolder,
    showScanFolders,
  } = useLibraryScanFolderActions({
    scanFolders,
    setActiveTab,
    setMenuOpen,
    setScanFolders,
    showAlert,
  });

  const { importFromDevice } = useLibraryImportActions({
    persistChangedFolderUpdates,
    scanFolders,
    setActiveTab,
    setImportStatus,
    setLoading,
    setMenuOpen,
    setSongs,
    showAlert,
    songs,
  });

  const { refreshMetadataFromFiles } = useLibraryMetadataRefreshActions({
    setImportStatus,
    setLoading,
    setMenuOpen,
    setSongs,
    showAlert,
    applySongMetadataPatches,
    songs,
  });

  return {
    closeMenu,
    importFromDevice,
    onAddScanFolder,
    openMenu,
    openSettings,
    openTrackInfo,
    refreshMetadataFromFiles,
    removeFolder,
    showScanFolders,
    toggleSearch,
  };
};
