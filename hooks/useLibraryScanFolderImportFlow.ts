import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import type { LibraryAlertCopy } from './useLibraryAlerts';
import type { ImportGeneration, ImportedSongsStateUpdate, TimeoutRunner } from './libraryImportActionTypes';
import type { importSongsFromSources } from '../utils/mediaLibraryImport';
import {
  buildScanImportResult,
  getScanImportProgressCopy,
} from '../utils/libraryImportFlow';

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

  return { importFromScanFolders };
};
