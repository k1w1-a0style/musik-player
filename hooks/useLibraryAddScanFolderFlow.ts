import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ScanFolder } from '../types/ScanFolder';
import {
  buildDirectoryPermissionSelectionResult,
  buildScanFolderFromDirectoryUri,
  buildScanFolderPickerAvailabilityResult,
} from '../utils/libraryScanFolders';
import {
  getScanFolderUnavailableAlert,
  getScanFolderUnsupportedAlert,
} from '../utils/libraryFolderMessages';
import { persistAddedScanFolder } from '../utils/libraryScanFolderPersistence';
import type {
  LibraryScanFolderAlertActions,
  LibraryScanFolderStateUpdateActions,
  RequestDirectoryPermissions,
} from './libraryScanFolderActionTypes';

interface UseLibraryAddScanFolderFlowOptions extends LibraryScanFolderAlertActions, LibraryScanFolderStateUpdateActions {
  scanFolders: ScanFolder[];
  setMenuOpen: Dispatch<SetStateAction<boolean>>;
  platformOs: string;
  requestDirectoryPermissionsAsync: RequestDirectoryPermissions;
  onFolderAdded?: (folder: ScanFolder) => Promise<void>;
}

export const useLibraryAddScanFolderFlow = ({
  scanFolders,
  setMenuOpen,
  showAlert,
  platformOs,
  requestDirectoryPermissionsAsync,
  applyScanFolderStateUpdate,
  onFolderAdded,
}: UseLibraryAddScanFolderFlowOptions): (() => Promise<void>) =>
  useCallback(async (): Promise<void> => {
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
        return;
      }

      const folder = buildScanFolderFromDirectoryUri(permissionResult.directoryUri);
      const addResult = await persistAddedScanFolder(scanFolders, folder);
      if (addResult.kind === 'duplicate') {
        const existing = scanFolders.find(item => item.uri === folder.uri && !item.removed);
        if (existing) await onFolderAdded?.(existing);
        return;
      }

      applyScanFolderStateUpdate(addResult.update);
      await onFolderAdded?.(addResult.update.scanFolders.find(item => item.uri === folder.uri) ?? folder);
    } catch {
      showAlert(getScanFolderUnavailableAlert());
    }
  }, [
    applyScanFolderStateUpdate,
    onFolderAdded,
    platformOs,
    requestDirectoryPermissionsAsync,
    scanFolders,
    setMenuOpen,
    showAlert,
  ]);
