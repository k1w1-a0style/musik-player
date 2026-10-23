import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Platform } from 'react-native';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import type { ScanFolder } from '../types/ScanFolder';
import type { LibraryTab } from '../utils/libraryTabs';
import type { LibraryAlertCopy } from './useLibraryAlerts';
import { buildScanFolderStateUpdate, buildDirectoryPermissionSelectionResult } from '../utils/libraryScanFolders';
import { deriveFolderNameFromUri, readSafDirectoryWithTimeout } from '../utils/mediaLibraryImport';
import { persistReauthorizedScanFolder } from '../utils/libraryScanFolderPersistence';
import { getDuplicateScanFolderAlert, getScanFolderCancelledAlert, getScanFolderUnsupportedAlert } from '../utils/libraryFolderMessages';
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
  onFolderAdded?: (folder: ScanFolder) => Promise<void>;
  readDirectoryAsync?: (uri: string) => Promise<string[]>;
}

export interface UseLibraryScanFolderActionsResult {
  showScanFolders: () => void;
  onAddScanFolder: () => Promise<void>;
  persistChangedFolderUpdates: (folderUpdates: ScanFolder[] | undefined) => Promise<void>;
  removeFolder: (folder: ScanFolder) => Promise<void>;
  repairFolder: (folder: ScanFolder) => Promise<void>;
}

export const useLibraryScanFolderActions = ({
  scanFolders,
  setScanFolders,
  setActiveTab,
  setMenuOpen,
  showAlert,
  platformOs = Platform.OS,
  requestDirectoryPermissionsAsync = StorageAccessFramework.requestDirectoryPermissionsAsync,
  onFolderAdded,
  readDirectoryAsync = StorageAccessFramework.readDirectoryAsync,
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
    onFolderAdded,
  });

  const { persistChangedFolderUpdates, removeFolder } = useLibraryScanFolderPersistenceActions({
    scanFolders,
    setScanFolders,
    showAlert,
  });

  const repairFolder = useCallback(async (folder: ScanFolder): Promise<void> => {
    if (platformOs !== 'android') {
      showAlert(getScanFolderUnsupportedAlert());
      return;
    }
    try {
      const selection = buildDirectoryPermissionSelectionResult(await requestDirectoryPermissionsAsync());
      if (selection.kind === 'cancelled') {
        showAlert(getScanFolderCancelledAlert());
        return;
      }
      // A picker grant alone does not prove that the provider can read the tree.
      // Do not replace the saved folder when this probe fails or times out.
      try {
        await readSafDirectoryWithTimeout(selection.directoryUri, readDirectoryAsync);
      } catch {
        showAlert({
          title: 'Ordner nicht lesbar',
          message: 'Android kann diesen Ordner nicht lesen. Wähle einen zugänglichen Musik-Unterordner. Der bisherige Eintrag und deine Titel bleiben erhalten.',
        });
        return;
      }
      const result = await persistReauthorizedScanFolder(
        folder.id, selection.directoryUri, deriveFolderNameFromUri(selection.directoryUri),
      );
      if (result.kind === 'duplicate') {
        showAlert(getDuplicateScanFolderAlert());
        return;
      }
      if (result.kind === 'missing') {
        showAlert({
          title: 'Ordner nicht mehr vorhanden',
          message: 'Der Scan-Ordner wurde zwischenzeitlich entfernt. Füge ihn bei Bedarf erneut hinzu.',
        });
        return;
      }
      setScanFolders(result.folders);
      await onFolderAdded?.(result.folder);
    } catch {
      showAlert({
        title: 'Zugriff nicht erneuert',
        message: 'Der Android-Ordnerzugriff oder das Speichern ist fehlgeschlagen. Deine Musik und die bisherige Ordnerliste bleiben erhalten.',
      });
    }
  }, [onFolderAdded, platformOs, readDirectoryAsync, requestDirectoryPermissionsAsync, setScanFolders, showAlert]);

  return {
    showScanFolders,
    onAddScanFolder,
    persistChangedFolderUpdates,
    removeFolder,
    repairFolder,
  };
};
