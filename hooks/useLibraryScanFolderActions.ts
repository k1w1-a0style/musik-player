import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Platform } from 'react-native';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import type { ScanFolder } from '../types/ScanFolder';
import type { LibraryTab } from '../utils/libraryTabs';
import type { LibraryAlertCopy } from './useLibraryAlerts';
import {
  buildDirectoryPermissionSelectionResult,
  buildScanFolderFromDirectoryUri,
  buildScanFolderPickerAvailabilityResult,
  buildScanFolderStateUpdate,
} from '../utils/libraryScanFolders';
import {
  getDuplicateScanFolderAlert,
  getScanFolderCancelledAlert,
  getScanFolderUnavailableAlert,
  getScanFolderUnsupportedAlert,
} from '../utils/libraryFolderMessages';
import {
  persistAddedScanFolder,
  persistChangedFolderErrorUpdates,
  persistRemovedScanFolder,
} from '../utils/libraryScanFolderPersistence';

interface DirectoryPermissionResultLike {
  granted?: boolean;
  directoryUri?: string | null;
}

type RequestDirectoryPermissions = () => Promise<DirectoryPermissionResultLike>;

type ScanFolderStateUpdate = ReturnType<typeof buildScanFolderStateUpdate>;

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
  const applyScanFolderStateUpdate = useCallback((update: ScanFolderStateUpdate) => {
    setScanFolders(update.scanFolders);
    setActiveTab(update.activeTab);
  }, [setActiveTab, setScanFolders]);

  const showScanFolders = useCallback(() => {
    const update = buildScanFolderStateUpdate(scanFolders);
    applyScanFolderStateUpdate(update);
    setMenuOpen(false);
  }, [applyScanFolderStateUpdate, scanFolders, setMenuOpen]);

  const onAddScanFolder = useCallback(async (): Promise<void> => {
    setMenuOpen(false);
    const pickerResult = buildScanFolderPickerAvailabilityResult(platformOs);
    if (pickerResult.kind === 'unsupported') {
      showAlert(getScanFolderUnsupportedAlert());
      return;
    }

    try {
      const permission = await requestDirectoryPermissionsAsync();
      const permissionResult = buildDirectoryPermissionSelectionResult(permission);
      if (permissionResult.kind === 'cancelled') {
        showAlert(getScanFolderCancelledAlert());
        return;
      }

      const folder = buildScanFolderFromDirectoryUri(permissionResult.directoryUri);
      const addResult = await persistAddedScanFolder(scanFolders, folder);
      if (addResult.kind === 'duplicate') {
        showAlert(getDuplicateScanFolderAlert());
        return;
      }

      applyScanFolderStateUpdate(addResult.update);
    } catch {
      showAlert(getScanFolderUnavailableAlert());
    }
  }, [applyScanFolderStateUpdate, platformOs, requestDirectoryPermissionsAsync, scanFolders, setMenuOpen, showAlert]);

  const persistChangedFolderUpdates = useCallback(async (folderUpdates: ScanFolder[] | undefined): Promise<void> => {
    const updatedFolders = await persistChangedFolderErrorUpdates(scanFolders, folderUpdates);
    if (updatedFolders) setScanFolders(updatedFolders);
  }, [scanFolders, setScanFolders]);

  const removeFolder = useCallback(async (folder: ScanFolder): Promise<void> => {
    setScanFolders(await persistRemovedScanFolder(folder.id));
  }, [setScanFolders]);

  return {
    showScanFolders,
    onAddScanFolder,
    persistChangedFolderUpdates,
    removeFolder,
  };
};
