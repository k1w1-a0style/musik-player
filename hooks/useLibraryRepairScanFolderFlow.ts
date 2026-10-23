import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ScanFolder } from '../types/ScanFolder';
import type { LibraryAlertCopy } from './useLibraryAlerts';
import type { RequestDirectoryPermissions } from './libraryScanFolderActionTypes';
import { buildDirectoryPermissionSelectionResult } from '../utils/libraryScanFolders';
import { deriveFolderNameFromUri, readSafDirectoryWithTimeout } from '../utils/mediaLibraryImport';
import { persistReauthorizedScanFolder } from '../utils/libraryScanFolderPersistence';
import { getDuplicateScanFolderAlert, getScanFolderCancelledAlert, getScanFolderUnsupportedAlert } from '../utils/libraryFolderMessages';

interface RepairScanFolderFlowOptions {
  setScanFolders: Dispatch<SetStateAction<ScanFolder[]>>;
  showAlert: (alert: LibraryAlertCopy) => void;
  platformOs: string;
  requestDirectoryPermissionsAsync: RequestDirectoryPermissions;
  readDirectoryAsync: (uri: string) => Promise<string[]>;
  onFolderAdded?: (folder: ScanFolder) => Promise<void>;
}

/** Android SAF permission recovery is intentionally separate from folder listing
 * to keep UI orchestration small and the storage update atomic. */
export const useLibraryRepairScanFolderFlow = ({
  setScanFolders, showAlert, platformOs, requestDirectoryPermissionsAsync, onFolderAdded, readDirectoryAsync,
}: RepairScanFolderFlowOptions): ((folder: ScanFolder) => Promise<void>) =>
useCallback(async (folder: ScanFolder): Promise<void> => {
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

