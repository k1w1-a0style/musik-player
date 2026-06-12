import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import type { LibraryAlertCopy } from './useLibraryAlerts';
import type { ImportGeneration, ImportedSongsStateUpdate, TimeoutRunner } from './libraryImportActionTypes';
import type { importSongsFromSources, SafDirectoryScanProgress } from '../utils/mediaLibraryImport';
import {
  buildScanImportResult,
  getScanImportProgressCopy,
} from '../utils/libraryImportFlow';
import { isTimeoutError } from '../utils/withTimeout';

const SAF_PROGRESS_STATUS_THROTTLE_MS = 400;

const buildSafScanProgressStatus = (progress: SafDirectoryScanProgress): string => {
  if (progress.directoriesVisited > 0) {
    return `Scan läuft… ${progress.directoriesVisited} Ordner gelesen, ${progress.filesFound} Titel gefunden`;
  }
  return `Scan läuft… ${progress.filesFound} Titel gefunden`;
};

interface UseLibraryScanFolderImportFlowOptions {
  songs: Song[];
  setImportStatus: Dispatch<SetStateAction<string | null>>;
  showAlert: (alert: LibraryAlertCopy) => void;
  persistChangedFolderUpdates: (folderUpdates: ScanFolder[] | undefined) => Promise<void>;
  platformOs: string;
  importTimeoutMs: number;
  importSongsFromSourcesImpl: typeof importSongsFromSources;
  withTimeoutImpl: TimeoutRunner;
  ensureCurrentImport: (generation: ImportGeneration) => void;
  applyImportedSongsUpdate: (update: ImportedSongsStateUpdate, generation: ImportGeneration) => void;
}

export const useLibraryScanFolderImportFlow = ({
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
}: UseLibraryScanFolderImportFlowOptions) => {
  const importFromScanFolders = useCallback(async (activeFolders: ScanFolder[], generation: ImportGeneration): Promise<void> => {
    const scanProgress = getScanImportProgressCopy(activeFolders.length, 0);
    ensureCurrentImport(generation);
    setImportStatus(scanProgress.readingStatus);
    let latestSafProgress: SafDirectoryScanProgress | undefined;
    let lastProgressStatusAt = 0;
    const publishSafProgress = (progress: SafDirectoryScanProgress): void => {
      latestSafProgress = progress;
      const now = Date.now();
      if (lastProgressStatusAt > 0 && now - lastProgressStatusAt < SAF_PROGRESS_STATUS_THROTTLE_MS) return;
      lastProgressStatusAt = now;
      ensureCurrentImport(generation);
      setImportStatus(buildSafScanProgressStatus(progress));
    };

    let result: Awaited<ReturnType<typeof importSongsFromSourcesImpl>>;
    try {
      result = await withTimeoutImpl(
        signal => importSongsFromSourcesImpl({ scanFolders: activeFolders, platformOs, signal, onSafProgress: publishSafProgress }),
        importTimeoutMs,
        scanProgress.timeoutMessage,
        { signal: generation.controller.signal },
      );
    } catch (error) {
      if (latestSafProgress && isTimeoutError(error)) {
        console.warn('[Import] SAF scan progress before timeout.', latestSafProgress);
      }
      throw error;
    }
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

  return { importFromScanFolders };
};
