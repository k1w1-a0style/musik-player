import { useCallback } from 'react';
import { Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { importSongsFromSources, scanMediaLibraryCandidates, enrichMediaLibraryAssets } from '../utils/mediaLibraryImport';
import { DEFAULT_LIBRARY_OPERATION_TIMEOUT_MS } from '../utils/libraryOperationTimeouts';
import { confirmLibraryImport } from '../utils/libraryImportConfirmation';
import { getEnabledScanFolders } from '../utils/libraryScanFolders';
import { isAbortError, isTimeoutError, withTimeout } from '../utils/withTimeout';
import {
  getImportStoppedAlert,
  getLibraryImportFlowCopy,
  shouldImportFromScanFolders,
} from '../utils/libraryImportFlow';
import type { UseLibraryImportActionsOptions, UseLibraryImportActionsResult } from './libraryImportActionTypes';
import { useLibraryImportLifecycle } from './useLibraryImportLifecycle';
import { useLibraryImportStateUpdate } from './useLibraryImportStateUpdate';
import { useLibraryScanFolderImportFlow } from './useLibraryScanFolderImportFlow';
import { useLibraryMediaLibraryImportFlow } from './useLibraryMediaLibraryImportFlow';

export type { UseLibraryImportActionsOptions, UseLibraryImportActionsResult } from './libraryImportActionTypes';

export const useLibraryImportActions = ({
  scanFolders,
  songs,
  setSongs,
  setActiveTab,
  setMenuOpen,
  setLoading,
  setImportStatus,
  showAlert,
  persistChangedFolderUpdates,
  platformOs = Platform.OS,
  importTimeoutMs = DEFAULT_LIBRARY_OPERATION_TIMEOUT_MS,
  importSongsFromSourcesImpl = importSongsFromSources,
  requestMediaLibraryPermissionsAsync = MediaLibrary.requestPermissionsAsync,
  scanMediaLibraryCandidatesImpl = scanMediaLibraryCandidates,
  enrichMediaLibraryAssetsImpl = enrichMediaLibraryAssets,
  confirmLibraryImportImpl = confirmLibraryImport,
  withTimeoutImpl = withTimeout,
}: UseLibraryImportActionsOptions): UseLibraryImportActionsResult => {
  const {
    startImport,
    isCurrentImport,
    ensureCurrentImport,
    finishImport,
  } = useLibraryImportLifecycle({ setLoading, setImportStatus });
  const { applyImportedSongsUpdate } = useLibraryImportStateUpdate({ setSongs, setActiveTab, ensureCurrentImport });
  const { importFromScanFolders } = useLibraryScanFolderImportFlow({
    songs,
    setImportStatus,
    showAlert,
    persistChangedFolderUpdates,
    platformOs,
    importTimeoutMs,
    importSongsFromSourcesImpl,
    withTimeoutImpl,
    ensureCurrentImport,
    applyImportedSongsUpdate,
  });
  const { importFromMediaLibrary } = useLibraryMediaLibraryImportFlow({
    songs,
    setImportStatus,
    showAlert,
    importTimeoutMs,
    requestMediaLibraryPermissionsAsync,
    scanMediaLibraryCandidatesImpl,
    enrichMediaLibraryAssetsImpl,
    confirmLibraryImportImpl,
    withTimeoutImpl,
    ensureCurrentImport,
    applyImportedSongsUpdate,
  });

  const importFromDevice = useCallback(async (): Promise<void> => {
    const generation = startImport();
    setMenuOpen(false);
    setLoading(true);
    const importCopy = getLibraryImportFlowCopy();
    try {
      setImportStatus(importCopy.preparingStatus);
      const activeFolders = getEnabledScanFolders(scanFolders);
      if (shouldImportFromScanFolders(activeFolders, platformOs)) {
        await importFromScanFolders(activeFolders, generation);
      } else {
        await importFromMediaLibrary(importCopy, generation);
      }
    } catch (error) {
      if (isTimeoutError(error)) {
        console.warn('[Import] Import timed out.', error);
      } else if (!isCurrentImport(generation) || isAbortError(error)) {
        console.warn('[Import] Import cancelled.', error);
        return;
      } else {
        console.warn('[Import] Import failed.', error);
      }
      showAlert(getImportStoppedAlert(error));
    } finally {
      finishImport(generation);
    }
  }, [finishImport, importFromMediaLibrary, importFromScanFolders, isCurrentImport, platformOs, scanFolders, setImportStatus, setLoading, setMenuOpen, showAlert, startImport]);

  return { importFromDevice };
};
