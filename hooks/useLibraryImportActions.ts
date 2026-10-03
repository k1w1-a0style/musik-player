import { useCallback } from 'react';
import { clearWaveformPreparation } from '../utils/libraryWaveformPreparation';
import { clearImportFileProgress } from '../utils/libraryImportProgress';
import { beginMetadataRefreshActivity, endMetadataRefreshActivity } from '../utils/metadataRefreshActivity';
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
import type {
  ImportGeneration,
  UseLibraryImportActionsOptions,
  UseLibraryImportActionsResult,
} from './libraryImportActionTypes';
import { useLibraryImportLifecycle } from './useLibraryImportLifecycle';
import { useLibraryImportStateUpdate } from './useLibraryImportStateUpdate';
import { useLibraryScanFolderImportFlow } from './useLibraryScanFolderImportFlow';
import { useLibraryMediaLibraryImportFlow } from './useLibraryMediaLibraryImportFlow';

export type { UseLibraryImportActionsOptions, UseLibraryImportActionsResult } from './libraryImportActionTypes';

type ImportAlert = UseLibraryImportActionsOptions['showAlert'];
type IsCurrentImport = (generation: ImportGeneration) => boolean;

const reportLibraryImportFailure = (
  error: unknown,
  generation: ImportGeneration,
  isCurrentImport: IsCurrentImport,
  showAlert: ImportAlert,
): void => {
  if (isTimeoutError(error)) {
    console.warn('[Import] Import timed out.', error);
  } else if (!isCurrentImport(generation) || isAbortError(error)) {
    console.warn('[Import] Import cancelled.', error);
    return;
  } else {
    console.warn('[Import] Import failed.', error);
  }
  showAlert(getImportStoppedAlert(error));
};

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

  const importFromDevice = useCallback(async (options?: { folders?: typeof scanFolders; refreshExisting?: boolean }): Promise<void> => {
    const generation = startImport();
    clearWaveformPreparation();
    clearImportFileProgress();
    beginMetadataRefreshActivity();
    setMenuOpen(false);
    setLoading(true);
    const importCopy = getLibraryImportFlowCopy();
    try {
      setImportStatus(importCopy.preparingStatus);
      const activeFolders = getEnabledScanFolders(options?.folders ?? scanFolders);
      if (shouldImportFromScanFolders(activeFolders, platformOs)) {
        await importFromScanFolders(activeFolders, generation, options?.refreshExisting ?? true);
      } else {
        await importFromMediaLibrary(importCopy, generation, options?.refreshExisting ?? true);
      }
    } catch (error) {
      reportLibraryImportFailure(error, generation, isCurrentImport, showAlert);
    } finally {
      endMetadataRefreshActivity();
      if (isCurrentImport(generation)) clearImportFileProgress();
      finishImport(generation);
    }
  }, [finishImport, importFromMediaLibrary, importFromScanFolders, isCurrentImport, platformOs, scanFolders, setImportStatus, setLoading, setMenuOpen, showAlert, startImport]);

  return { importFromDevice };
};
