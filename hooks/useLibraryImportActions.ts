import { useCallback } from 'react';
import { clearWaveformPreparation } from '../utils/libraryWaveformPreparation';
import { clearImportFileProgress } from '../utils/libraryImportProgress';
import { beginMetadataRefreshActivity, endMetadataRefreshActivity } from '../utils/metadataRefreshActivity';
import { Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library/legacy';
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
import { createCoverCacheProtection } from '../utils/coverCacheCleanup';
import { beginLibraryScan, completeLibraryScan, stopLibraryScan } from '../utils/libraryScanOperation';

export type { UseLibraryImportActionsOptions, UseLibraryImportActionsResult } from './libraryImportActionTypes';

type ImportAlert = UseLibraryImportActionsOptions['showAlert'];
type IsCurrentImport = (generation: ImportGeneration) => boolean;

const waitForImportPersistence = async (songImport: UseLibraryImportActionsOptions['songImport'],
  generation: ImportGeneration, timeoutMs: number): Promise<void> => {
  if (!songImport) return;
  await withTimeout(() => songImport.waitForCheckpoints(), timeoutMs,
    'Vorheriger Import speichert noch. Bitte nach Abschluss des Schreibvorgangs erneut versuchen.',
    { signal: generation.controller.signal });
};

const beginImportActivities = (generation: ImportGeneration, fullScan: boolean): void => {
  generation.scanOperationId = beginLibraryScan(fullScan);
  generation.coverCacheProtection = createCoverCacheProtection();
  clearWaveformPreparation();
  clearImportFileProgress();
  beginMetadataRefreshActivity();
};

const reportLibraryImportFailure = (
  error: unknown,
  generation: ImportGeneration,
  isCurrentImport: IsCurrentImport,
  showAlert: ImportAlert,
): void => {
  if (!isCurrentImport(generation) || isAbortError(error)) {
    console.warn('[Import] Import cancelled.', error);
    return;
  } else if (isTimeoutError(error)) {
    console.warn('[Import] Import timed out.', error);
  } else {
    console.warn('[Import] Import failed.', error);
  }
  showAlert(getImportStoppedAlert(error));
};

export const useLibraryImportActions = ({
  scanFolders,
  songs, songImport,
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
  const { startImport, isCurrentImport, ensureCurrentImport, finishImport, cancelImport } =
    useLibraryImportLifecycle({ setLoading, setImportStatus });
  const { applyImportedSongsUpdate, publishImportedSongs } = useLibraryImportStateUpdate({ songs, setSongs, setActiveTab, ensureCurrentImport, songImport });
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
    applyImportedSongsUpdate, publishImportedSongs,
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
    applyImportedSongsUpdate, publishImportedSongs,
  });

  const importFromDevice = useCallback(async (options?: { folders?: typeof scanFolders; refreshExisting?: boolean }): Promise<void> => {
    const generation = startImport();
    beginImportActivities(generation, options?.refreshExisting ?? false);
    setMenuOpen(false);
    setLoading(true);
    const importCopy = getLibraryImportFlowCopy();
    try {
      setImportStatus(importCopy.preparingStatus);
      await waitForImportPersistence(songImport, generation, importTimeoutMs);
      ensureCurrentImport(generation);
      const baselineSongs = songImport?.getCurrent() ?? songs;
      const activeFolders = getEnabledScanFolders(options?.folders ?? scanFolders);
      if (shouldImportFromScanFolders(activeFolders, platformOs)) {
        await importFromScanFolders(activeFolders, generation, options?.refreshExisting ?? false, baselineSongs);
      } else {
        await importFromMediaLibrary(importCopy, generation, options?.refreshExisting ?? false, baselineSongs);
      }
      completeLibraryScan(generation.scanOperationId);
    } catch (error) {
      stopLibraryScan(generation.scanOperationId, isAbortError(error) ? 'cancelled' : 'failed');
      reportLibraryImportFailure(error, generation, isCurrentImport, showAlert);
    } finally {
      generation.coverCacheProtection?.release();
      endMetadataRefreshActivity();
      if (isCurrentImport(generation)) clearImportFileProgress();
      finishImport(generation);
    }
  }, [ensureCurrentImport, finishImport, importFromMediaLibrary, importFromScanFolders, importTimeoutMs, isCurrentImport, platformOs, scanFolders, setImportStatus, setLoading, setMenuOpen, showAlert, songImport, songs, startImport]);

  return { importFromDevice, cancelImport };
};
