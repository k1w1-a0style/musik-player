import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ScanFolder } from '../types/ScanFolder';
import {
  buildDirectoryPermissionSelectionResult,
  buildScanFolderFromDirectoryUri,
  buildScanFolderPickerAvailabilityResult,
} from '../utils/libraryScanFolders';
import {
  getDuplicateScanFolderAlert,
  getScanFolderCancelledAlert,
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
}

export const useLibraryAddScanFolderFlow = ({
  scanFolders,
  setMenuOpen,
  showAlert,
  platformOs,
  requestDirectoryPermissionsAsync,
  applyScanFolderStateUpdate,
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
  }, [
    applyScanFolderStateUpdate,
    platformOs,
    requestDirectoryPermissionsAsync,
    scanFolders,
    setMenuOpen,
    showAlert,
  ]);
