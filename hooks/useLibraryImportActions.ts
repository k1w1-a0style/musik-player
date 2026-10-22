import { useCallback } from 'react';
import { clearWaveformPreparation, prepareLibraryWaveforms } from '../utils/libraryWaveformPreparation';
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
import type { Song } from '../types/Song';
import { isMediaLibraryReadAccessError } from '../utils/mediaLibraryReadAccess';
import { musicAccessButtons } from './useLibraryAlerts';

export type { UseLibraryImportActionsOptions, UseLibraryImportActionsResult } from './libraryImportActionTypes';

type ImportAlert = UseLibraryImportActionsOptions['showAlert'];
type IsCurrentImport = (generation: ImportGeneration) => boolean;

const startOptionalWaveformPreparation = (songs: Song[]): void => {
  if (!songs.length) return;
  void prepareLibraryWaveforms(songs).catch(error => {
    console.warn('[Preparation] Optional waveform preparation failed after the saved scan.', error);
  });
};

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
  onSelectMusicFolder?: () => void,
): void => {
  if (!isCurrentImport(generation) || isAbortError(error)) {
    console.warn('[Import] Import cancelled.', error);
    return;
  } else if (isTimeoutError(error)) {
    console.warn('[Import] Import timed out.', error);
  } else {
    console.warn('[Import] Import failed.', error);
  }
  const alert = getImportStoppedAlert(error);
  showAlert(isMediaLibraryReadAccessError(error)
    ? { ...alert, buttons: musicAccessButtons(onSelectMusicFolder) } : alert);
};

const recordScanFailure = (error: unknown, generation: ImportGeneration): void => {
  const cancelled = isAbortError(error);
  // Keep the existing translated Error/fallback message after the alert closes.
  stopLibraryScan(generation.scanOperationId, cancelled ? 'cancelled' : 'failed',
    cancelled ? undefined : getImportStoppedAlert(error).message);
};

export const useLibraryImportActions = ({
  scanFolders, songs, songImport, setSongs, setActiveTab, setMenuOpen,
  setLoading, setImportStatus, showAlert,
  persistChangedFolderUpdates,
  platformOs = Platform.OS,
  importTimeoutMs = DEFAULT_LIBRARY_OPERATION_TIMEOUT_MS,
  importSongsFromSourcesImpl = importSongsFromSources,
  requestMediaLibraryPermissionsAsync = MediaLibrary.requestPermissionsAsync,
  getMediaLibraryPermissionsAsync = MediaLibrary.getPermissionsAsync,
  onSelectMusicFolder,
  scanMediaLibraryCandidatesImpl = scanMediaLibraryCandidates,
  enrichMediaLibraryAssetsImpl = enrichMediaLibraryAssets,
  confirmLibraryImportImpl = confirmLibraryImport,
  withTimeoutImpl = withTimeout,
}: UseLibraryImportActionsOptions): UseLibraryImportActionsResult => {
  const { startImport, isCurrentImport, ensureCurrentImport, finishImport, cancelImport } =
    useLibraryImportLifecycle({ setLoading, setImportStatus });
  const { applyImportedSongsUpdate, publishImportedSongs } = useLibraryImportStateUpdate({ songs, setSongs, setActiveTab, ensureCurrentImport, songImport, timeoutMs: importTimeoutMs });
  const sharedFlowOptions = {
    songs, setImportStatus, showAlert, importTimeoutMs, withTimeoutImpl,
    ensureCurrentImport, applyImportedSongsUpdate, publishImportedSongs,
  };
  const { importFromScanFolders } = useLibraryScanFolderImportFlow({
    ...sharedFlowOptions,
    persistChangedFolderUpdates,
    platformOs,
    importSongsFromSourcesImpl,
  });
  const { importFromMediaLibrary } = useLibraryMediaLibraryImportFlow({
    ...sharedFlowOptions,
    requestMediaLibraryPermissionsAsync,
    getMediaLibraryPermissionsAsync,
    scanMediaLibraryCandidatesImpl,
    enrichMediaLibraryAssetsImpl,
    confirmLibraryImportImpl,
  });

  const importFromDevice = useCallback(async (options?: { folders?: typeof scanFolders; refreshExisting?: boolean }): Promise<void> => {
    const generation = startImport();
    beginImportActivities(generation, options?.refreshExisting ?? false);
    setMenuOpen(false);
    setLoading(true);
    const importCopy = getLibraryImportFlowCopy();
    let preparationSongs: Song[] = [];
    let scanCompleted = false;
    try {
      setImportStatus(importCopy.preparingStatus);
      await waitForImportPersistence(songImport, generation, importTimeoutMs);
      ensureCurrentImport(generation);
      const baselineSongs = songImport?.getCurrent() ?? songs;
      const activeFolders = getEnabledScanFolders(options?.folders ?? scanFolders);
      if (shouldImportFromScanFolders(activeFolders, platformOs)) {
        preparationSongs = await importFromScanFolders(activeFolders, generation, options?.refreshExisting ?? false, baselineSongs);
      } else {
        preparationSongs = await importFromMediaLibrary(importCopy, generation, options?.refreshExisting ?? false, baselineSongs);
      }
      ensureCurrentImport(generation);
      completeLibraryScan(generation.scanOperationId);
      scanCompleted = true;
    } catch (error) {
      recordScanFailure(error, generation);
      reportLibraryImportFailure(error, generation, isCurrentImport, showAlert, onSelectMusicFolder);
    } finally {
      generation.coverCacheProtection?.release();
      endMetadataRefreshActivity();
      if (isCurrentImport(generation)) clearImportFileProgress();
      finishImport(generation);
    }
    // The durable scan has finished. Optional analysis owns its own cancellation
    // and status; navigation or a scan observer must not turn it into a hung scan.
    if (scanCompleted) startOptionalWaveformPreparation(preparationSongs);
  }, [ensureCurrentImport, finishImport, importFromMediaLibrary, importFromScanFolders, importTimeoutMs, isCurrentImport, platformOs, scanFolders, setImportStatus, setLoading, setMenuOpen, showAlert, songImport, songs, startImport, onSelectMusicFolder]);

  return { importFromDevice, cancelImport };
};
