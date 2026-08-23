import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Platform } from 'react-native';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import type { ScanFolder } from '../types/ScanFolder';
import type { LibraryTab } from '../utils/libraryTabs';
import type { LibraryAlertCopy } from './useLibraryAlerts';
import { buildScanFolderStateUpdate } from '../utils/libraryScanFolders';
import type { RequestDirectoryPermissions } from './libraryScanFolderActionTypes';
import { useLibraryAddScanFolderFlow } from './useLibraryAddScanFolderFlow';
import { useLibraryScanFolderPersistenceActions } from './useLibraryScanFolderPersistenceActions';
import { useLibraryScanFolderStateUpdate } from './useLibraryScanFolderStateUpdate';

export interface UseLibraryScanFolderActionsOptions {
  scanFolders: ScanFolder[];
  setScanFolders: Dispatch<SetStateAction<ScanFolder[]>>;
  setActiveTab: Dispatch<SetStateAction<LibraryTab>>;
  setMenuOpen: Dispatch<SetStateAction<boolean>>;
  showAlert: (alert: LibraryAlertCopy) => void;
  platformOs?: string;
  requestDirectoryPermissionsAsync?: RequestDirectoryPermissions;
}

export interface UseLibraryScanFolderActionsResult {
  showScanFolders: () => void;
  onAddScanFolder: () => Promise<void>;
  persistChangedFolderUpdates: (folderUpdates: ScanFolder[] | undefined) => Promise<void>;
  removeFolder: (folder: ScanFolder) => Promise<void>;
}

export const useLibraryScanFolderActions = ({
  scanFolders,
  setScanFolders,
  setActiveTab,
  setMenuOpen,
  showAlert,
  platformOs = Platform.OS,
  requestDirectoryPermissionsAsync = StorageAccessFramework.requestDirectoryPermissionsAsync,
}: UseLibraryScanFolderActionsOptions): UseLibraryScanFolderActionsResult => {
  const { applyScanFolderStateUpdate } = useLibraryScanFolderStateUpdate({ setScanFolders, setActiveTab });

  const showScanFolders = useCallback(() => {
    const update = buildScanFolderStateUpdate(scanFolders);
    applyScanFolderStateUpdate(update);
    setMenuOpen(false);
  }, [applyScanFolderStateUpdate, scanFolders, setMenuOpen]);

  const onAddScanFolder = useLibraryAddScanFolderFlow({
    scanFolders,
    setMenuOpen,
    showAlert,
    platformOs,
    requestDirectoryPermissionsAsync,
    applyScanFolderStateUpdate,
  });

  const { persistChangedFolderUpdates, removeFolder } = useLibraryScanFolderPersistenceActions({
    scanFolders,
    setScanFolders,
    showAlert,
  });

  return {
    showScanFolders,
    onAddScanFolder,
    persistChangedFolderUpdates,
    removeFolder,
  };
};
