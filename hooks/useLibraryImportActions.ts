import { useCallback } from 'react';
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
import { withTimeout } from '../utils/withTimeout';
import { useAsyncInFlightGuard } from './useAsyncInFlightGuard';
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

type LibraryImportFlowCopy = ReturnType<typeof getLibraryImportFlowCopy>;
type RequestMediaLibraryPermissions = () => Promise<{ status: string }>;
type TimeoutRunner = <T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string) => Promise<T>;

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
  const runImportOnce = useAsyncInFlightGuard();

  const applyImportedSongsUpdate = useCallback((update: ImportedSongsStateUpdate) => {
    setSongs(update.songs);
    setActiveTab(update.activeTab);
  }, [setActiveTab, setSongs]);

  const importFromScanFolders = useCallback(async (activeFolders: ScanFolder[]): Promise<void> => {
    const scanProgress = getScanImportProgressCopy(activeFolders.length, 0);
    setImportStatus(scanProgress.readingStatus);
    const result = await withTimeoutImpl(
      importSongsFromSourcesImpl({ scanFolders: activeFolders, platformOs }),
      importTimeoutMs,
      scanProgress.timeoutMessage,
    );
    const resultProgress = getScanImportProgressCopy(activeFolders.length, result.songs.length);
    setImportStatus(resultProgress.foundStatus);
    await persistChangedFolderUpdates(result.folderUpdates);
    const scanResult = buildScanImportResult(songs, result.songs, result.errors);
    if (scanResult.kind === 'empty') {
      showAlert(scanResult.alert);
      return;
    }
    if (scanResult.partialAlert) showAlert(scanResult.partialAlert);
    applyImportedSongsUpdate(scanResult.update);
  }, [applyImportedSongsUpdate, importSongsFromSourcesImpl, importTimeoutMs, persistChangedFolderUpdates, platformOs, setImportStatus, showAlert, songs, withTimeoutImpl]);

  const importFromMediaLibrary = useCallback(async (importCopy: LibraryImportFlowCopy): Promise<void> => {
    setImportStatus(importCopy.scanningMediaLibraryStatus);
    const { status } = await requestMediaLibraryPermissionsAsync();
    const permissionResult = buildMediaLibraryPermissionResult(status);
    if (permissionResult.kind === 'denied') {
      showAlert(permissionResult.alert);
      return;
    }
    const candidates = await withTimeoutImpl(scanMediaLibraryCandidatesImpl(), importTimeoutMs, importCopy.mediaLibraryScanTimeoutMessage);
    const candidateProgress = getMediaLibraryImportProgressCopy(candidates.assets.length, 0);
    setImportStatus(candidateProgress.candidatesFoundStatus);
    const candidateResult = buildMediaLibraryCandidatesResult(candidates.assets.length);
    if (candidateResult.kind === 'empty') {
      showAlert(candidateResult.alert);
      return;
    }
    const shouldImport = await confirmLibraryImportImpl(candidates.assets.length, candidates.skipped.length);
    if (!shouldImport) return;
    setImportStatus(importCopy.importingMetadataAndCoversStatus);
    const mediaResult = await withTimeoutImpl(
      enrichMediaLibraryAssetsImpl(candidates.assets, candidates.skipped.length),
      importTimeoutMs,
      importCopy.metadataImportTimeoutMessage,
    );
    const savingProgress = getMediaLibraryImportProgressCopy(candidates.assets.length, mediaResult.songs.length);
    setImportStatus(savingProgress.savingStatus);
    const importResult = buildMediaLibraryImportResult(songs, mediaResult.songs);
    applyImportedSongsUpdate(importResult.update);
  }, [applyImportedSongsUpdate, confirmLibraryImportImpl, enrichMediaLibraryAssetsImpl, importTimeoutMs, requestMediaLibraryPermissionsAsync, scanMediaLibraryCandidatesImpl, setImportStatus, showAlert, songs, withTimeoutImpl]);

  const importFromDevice = useCallback(async (): Promise<void> => runImportOnce(async () => {
    setMenuOpen(false);
    const importCopy = getLibraryImportFlowCopy();
    setImportStatus(importCopy.preparingStatus);
    try {
      setLoading(true);
      const activeFolders = getEnabledScanFolders(scanFolders);
      if (shouldImportFromScanFolders(activeFolders, platformOs)) {
        await importFromScanFolders(activeFolders);
        return;
      }

      await importFromMediaLibrary(importCopy);
    } catch (error) {
      const stoppedAlert = getImportStoppedAlert(error);
      showAlert(stoppedAlert);
    } finally {
      setLoading(false);
      setImportStatus(null);
    }
  }), [importFromMediaLibrary, importFromScanFolders, platformOs, runImportOnce, scanFolders, setImportStatus, setLoading, setMenuOpen, showAlert]);

  return { importFromDevice };
};
