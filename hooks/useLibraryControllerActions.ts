import { useCallback, useRef } from 'react';
import type { SongImportController } from '../contexts/songLibraryState';
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
  searchOpen: boolean;
  scanFolders: ScanFolder[];
  setActiveTab: Dispatch<SetStateAction<LibraryTab>>;
  setImportStatus: Dispatch<SetStateAction<string | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setMenuOpen: Dispatch<SetStateAction<boolean>>;
  setQuery: Dispatch<SetStateAction<string>>;
  setScanFolders: Dispatch<SetStateAction<ScanFolder[]>>;
  setSearchOpen: Dispatch<SetStateAction<boolean>>;
  setSongs: (songs: Song[]) => void;
  applySongMetadataPatches?: (patchesBySongId: SongMetadataPatchesById) => void;
  songs: Song[];
  songImport?: SongImportController;
}

export interface UseLibraryControllerActionsResult {
  closeMenu: () => void;
  importFromDevice: ReturnType<typeof useLibraryImportActions>['importFromDevice'];
  onAddScanFolder: () => Promise<void>;
  openMenu: () => void;
  openSettings: () => void;
  openEqualizer: () => void;
  openPlaylistDetail: (playlistId: string) => void;
  openTrackInfo: (song: Song) => void;
  refreshMetadataFromFiles: () => Promise<void>;
  cancelMetadataRefresh: () => boolean;
  resumeMetadataRefresh: () => Promise<void>;
  removeFolder: (folder: ScanFolder) => Promise<void>;
  showScanFolders: () => void;
  toggleSearch: () => void;
}

export const useLibraryControllerActions = ({
  searchOpen, scanFolders, setActiveTab, setImportStatus, setLoading, setMenuOpen,
  setQuery, setScanFolders, setSearchOpen, setSongs, applySongMetadataPatches, songs, songImport,
}: UseLibraryControllerActionsOptions): UseLibraryControllerActionsResult => {
  const importActionRef = useRef<ReturnType<typeof useLibraryImportActions>['importFromDevice'] | null>(null);
  const scanAddedFolder = useCallback(async (folder: ScanFolder): Promise<void> => {
    await importActionRef.current?.({ folders: [folder], refreshExisting: false });
  }, []);
  const { openPlaylistDetail, openTrackInfo, openEqualizer: navigateToEqualizer, openSettings: navigateToSettings } =
    useLibraryNavigationActions();
  const { showAlert } = useLibraryAlerts();

  const openEqualizer = useCallback(() => {
    setMenuOpen(false);
    navigateToEqualizer();
  }, [navigateToEqualizer, setMenuOpen]);

  const { closeMenu, openMenu, openSettings, toggleSearch } = useLibraryMenuActions({
    searchOpen,
    setMenuOpen,
    setQuery,
    setSearchOpen,
    onOpenSettings: navigateToSettings,
  });

  const { onAddScanFolder, persistChangedFolderUpdates, removeFolder, showScanFolders } =
    useLibraryScanFolderActions({
      scanFolders,
      setActiveTab,
      setMenuOpen,
      setScanFolders,
      showAlert,
      onFolderAdded: scanAddedFolder,
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
    songs, songImport,
  });
  importActionRef.current = importFromDevice;

  const { refreshMetadataFromFiles, cancelRefresh, resumeMetadataRefresh } = useLibraryMetadataRefreshActions({
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
    openEqualizer,
    openPlaylistDetail,
    openTrackInfo,
    refreshMetadataFromFiles,
    cancelMetadataRefresh: cancelRefresh,
    resumeMetadataRefresh,
    removeFolder,
    showScanFolders,
    toggleSearch,
  };
};
