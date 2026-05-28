import { useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import type { Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import type { LibraryTab } from '../utils/libraryTabs';
import type { LibraryAlertCopy } from './useLibraryAlerts';
import { importSongsFromSources, scanMediaLibraryCandidates, enrichMediaLibraryAssets } from '../utils/mediaLibraryImport';
import { confirmLibraryImport } from '../utils/libraryImportConfirmation';
import { getEnabledScanFolders } from '../utils/libraryScanFolders';
import { OperationAbortError, isAbortError, isTimeoutError, throwIfAborted, withTimeout, type CancellableOperation, type TimeoutOptions } from '../utils/withTimeout';
import {
  buildMediaLibraryCandidatesResult,
  buildMediaLibraryImportResult,
  buildMediaLibraryPermissionResult,
  buildScanImportResult,
  getImportStoppedAlert,
  getLibraryImportFlowCopy,
  getMediaLibraryImportProgressCopy,
  getScanImportProgressCopy,
  shouldImportFromScanFolders,
} from '../utils/libraryImportFlow';

interface ImportedSongsStateUpdate {
  songs: Song[];
  activeTab: LibraryTab;
}

interface ImportGeneration {
  controller: AbortController;
  id: number;
}

type LibraryImportFlowCopy = ReturnType<typeof getLibraryImportFlowCopy>;
type RequestMediaLibraryPermissions = () => Promise<{ status: string }>;
type TimeoutRunner = <T>(operation: Promise<T> | CancellableOperation<T>, timeoutMs: number, timeoutMessage: string, options?: TimeoutOptions) => Promise<T>;

export interface UseLibraryImportActionsOptions {
  scanFolders: ScanFolder[];
  songs: Song[];
  setSongs: (songs: Song[]) => void;
  setActiveTab: Dispatch<SetStateAction<LibraryTab>>;
  setMenuOpen: Dispatch<SetStateAction<boolean>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setImportStatus: Dispatch<SetStateAction<string | null>>;
  showAlert: (alert: LibraryAlertCopy) => void;
  persistChangedFolderUpdates: (folderUpdates: ScanFolder[] | undefined) => Promise<void>;
  platformOs?: string;
  importTimeoutMs?: number;
  importSongsFromSourcesImpl?: typeof importSongsFromSources;
  requestMediaLibraryPermissionsAsync?: RequestMediaLibraryPermissions;
  scanMediaLibraryCandidatesImpl?: typeof scanMediaLibraryCandidates;
  enrichMediaLibraryAssetsImpl?: typeof enrichMediaLibraryAssets;
  confirmLibraryImportImpl?: typeof confirmLibraryImport;
  withTimeoutImpl?: TimeoutRunner;
}

export interface UseLibraryImportActionsResult {
  importFromDevice: () => Promise<void>;
}

const DEFAULT_IMPORT_TIMEOUT_MS = 90_000;

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
  importTimeoutMs = DEFAULT_IMPORT_TIMEOUT_MS,
  importSongsFromSourcesImpl = importSongsFromSources,
  requestMediaLibraryPermissionsAsync = MediaLibrary.requestPermissionsAsync,
  scanMediaLibraryCandidatesImpl = scanMediaLibraryCandidates,
  enrichMediaLibraryAssetsImpl = enrichMediaLibraryAssets,
  confirmLibraryImportImpl = confirmLibraryImport,
  withTimeoutImpl = withTimeout,
}: UseLibraryImportActionsOptions): UseLibraryImportActionsResult => {
  const generationRef = useRef(0);
  const activeImportRef = useRef<ImportGeneration | null>(null);

  const isCurrentImport = useCallback((generation: ImportGeneration): boolean =>
    activeImportRef.current?.id === generation.id && !generation.controller.signal.aborted,
  []);

  const ensureCurrentImport = useCallback((generation: ImportGeneration): void => {
    if (!isCurrentImport(generation)) throwIfAborted(generation.controller.signal);
  }, [isCurrentImport]);

  const applyImportedSongsUpdate = useCallback((update: ImportedSongsStateUpdate, generation: ImportGeneration) => {
    ensureCurrentImport(generation);
    setSongs(update.songs);
    ensureCurrentImport(generation);
    setActiveTab(update.activeTab);
  }, [ensureCurrentImport, setActiveTab, setSongs]);

  const importFromScanFolders = useCallback(async (activeFolders: ScanFolder[], generation: ImportGeneration): Promise<void> => {
    const scanProgress = getScanImportProgressCopy(activeFolders.length, 0);
    ensureCurrentImport(generation);
    setImportStatus(scanProgress.readingStatus);
    const result = await withTimeoutImpl(
      signal => importSongsFromSourcesImpl({ scanFolders: activeFolders, platformOs, signal }),
      importTimeoutMs,
      scanProgress.timeoutMessage,
      { signal: generation.controller.signal },
    );
    ensureCurrentImport(generation);
    const resultProgress = getScanImportProgressCopy(activeFolders.length, result.songs.length);
    setImportStatus(resultProgress.foundStatus);
    const scanResult = buildScanImportResult(songs, result.songs, result.errors);
    if (scanResult.kind === 'empty') {
      ensureCurrentImport(generation);
      try {
        await persistChangedFolderUpdates(result.folderUpdates);
      } catch (error) {
        console.warn('[Import] Failed to persist scan folder updates after empty import.', error);
      }
      ensureCurrentImport(generation);
      showAlert(scanResult.alert);
      return;
    }
    if (scanResult.partialAlert) showAlert(scanResult.partialAlert);
    applyImportedSongsUpdate(scanResult.update, generation);
    ensureCurrentImport(generation);
    try {
      await persistChangedFolderUpdates(result.folderUpdates);
    } catch (error) {
      console.warn('[Import] Failed to persist scan folder updates after import.', error);
    }
  }, [applyImportedSongsUpdate, ensureCurrentImport, importSongsFromSourcesImpl, importTimeoutMs, persistChangedFolderUpdates, platformOs, setImportStatus, showAlert, songs, withTimeoutImpl]);

  const importFromMediaLibrary = useCallback(async (importCopy: LibraryImportFlowCopy, generation: ImportGeneration): Promise<void> => {
    ensureCurrentImport(generation);
    setImportStatus(importCopy.scanningMediaLibraryStatus);
    const { status } = await requestMediaLibraryPermissionsAsync();
    ensureCurrentImport(generation);
    const permissionResult = buildMediaLibraryPermissionResult(status);
    if (permissionResult.kind === 'denied') {
      showAlert(permissionResult.alert);
      return;
    }
    const candidates = await withTimeoutImpl(
      signal => scanMediaLibraryCandidatesImpl({ signal }),
      importTimeoutMs,
      importCopy.mediaLibraryScanTimeoutMessage,
      { signal: generation.controller.signal },
    );
    ensureCurrentImport(generation);
    const candidateProgress = getMediaLibraryImportProgressCopy(candidates.assets.length, 0);
    setImportStatus(candidateProgress.candidatesFoundStatus);
    const candidateResult = buildMediaLibraryCandidatesResult(candidates.assets.length);
    if (candidateResult.kind === 'empty') {
      showAlert(candidateResult.alert);
      return;
    }
    const shouldImport = await confirmLibraryImportImpl(candidates.assets.length, candidates.skipped.length);
    ensureCurrentImport(generation);
    if (!shouldImport) return;
    setImportStatus(importCopy.importingMetadataAndCoversStatus);
    const mediaResult = await withTimeoutImpl(
      signal => enrichMediaLibraryAssetsImpl(candidates.assets, candidates.skipped.length, { signal }),
      importTimeoutMs,
      importCopy.metadataImportTimeoutMessage,
      { signal: generation.controller.signal },
    );
    ensureCurrentImport(generation);
    const mediaProgress = getMediaLibraryImportProgressCopy(candidates.assets.length, mediaResult.songs.length);
    setImportStatus(mediaProgress.savingStatus);
    const result = buildMediaLibraryImportResult(songs, mediaResult.songs);
    applyImportedSongsUpdate(result.update, generation);
  }, [applyImportedSongsUpdate, confirmLibraryImportImpl, ensureCurrentImport, enrichMediaLibraryAssetsImpl, importTimeoutMs, requestMediaLibraryPermissionsAsync, scanMediaLibraryCandidatesImpl, setImportStatus, showAlert, songs, withTimeoutImpl]);

  const importFromDevice = useCallback(async (): Promise<void> => {
    const previousImport = activeImportRef.current;
    previousImport?.controller.abort(new OperationAbortError('Import superseded by a newer import'));
    const generation = { controller: new AbortController(), id: generationRef.current + 1 };
    generationRef.current = generation.id;
    activeImportRef.current = generation;
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
      if (activeImportRef.current?.id === generation.id) {
        activeImportRef.current = null;
        setLoading(false);
        setImportStatus(null);
      }
    }
  }, [importFromMediaLibrary, importFromScanFolders, isCurrentImport, platformOs, scanFolders, setImportStatus, setLoading, setMenuOpen, showAlert]);

  return { importFromDevice };
};
