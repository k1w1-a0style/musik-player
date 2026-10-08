import { useCallback } from 'react';
import { prepareLibraryWaveforms } from '../utils/libraryWaveformPreparation';
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
import { isAbortError, isTimeoutError, withTimeout } from '../utils/withTimeout';
import { getImportedPreparationSongs } from '../utils/libraryImportSources';
import { withImportInactivityTimeout } from '../utils/libraryImportBudget';
import { getImportVerificationAlert } from '../utils/libraryImportOutcome';
import { createImportProgressCallbacks } from '../utils/libraryImportProgressCallbacks';
import { recordLibraryScanResult } from '../utils/libraryScanOperation';
import { createLibraryScanProgressCallbacks } from '../utils/libraryScanProgress';

const SAF_PROGRESS_STATUS_THROTTLE_MS = 400;

const buildSafScanProgressStatus = (progress: SafDirectoryScanProgress): string => {
  if (progress.filesFound === 0) return 'Ordner wird auf neue oder geänderte Titel geprüft…';
  if (progress.directoriesVisited > 0) {
    return `Scan läuft… ${progress.directoriesVisited} Ordner gelesen, ${progress.filesFound} Titel gefunden`;
  }
  return `Scan läuft… ${progress.filesFound} Titel gefunden`;
};

const persistScanFolderUpdates = async (persist: (updates: ScanFolder[] | undefined) => Promise<void>,
  updates: ScanFolder[] | undefined, generation: ImportGeneration, timeoutMs: number): Promise<void> => {
  try { await withTimeout(() => persist(updates), timeoutMs,
    'Ordnerdaten werden noch gespeichert. Bitte nach Abschluss erneut versuchen.',
    { signal: generation.controller.signal }); }
  catch (error) {
    if (isAbortError(error) || isTimeoutError(error)) throw error;
    console.warn('[Import] Failed to persist scan folder updates after import.', error);
  }
};

const createSafProgressPublisher = (publish: (status: string) => void, isActive: () => boolean, activity: () => void) => {
  let latest: SafDirectoryScanProgress | undefined;
  let lastPublishedAt = 0;
  return {
    getLatest: () => latest,
    onProgress: (progress: SafDirectoryScanProgress): void => {
      if (!isActive()) return;
      activity();
      latest = progress;
      const now = Date.now();
      if (lastPublishedAt > 0 && now - lastPublishedAt < SAF_PROGRESS_STATUS_THROTTLE_MS) return;
      lastPublishedAt = now;
      publish(buildSafScanProgressStatus(progress));
    },
  };
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
  applyImportedSongsUpdate: (update: ImportedSongsStateUpdate, generation: ImportGeneration, publish?: boolean) => Promise<Song[]>;
  publishImportedSongs: (generation: ImportGeneration) => Song[];
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
  applyImportedSongsUpdate, publishImportedSongs,
}: UseLibraryScanFolderImportFlowOptions) => {
  const importFromScanFolders = useCallback(async (activeFolders: ScanFolder[], generation: ImportGeneration,
    refreshExisting = false, baselineSongs = songs): Promise<void> => {
    const scanProgress = getScanImportProgressCopy(activeFolders.length, 0);
    ensureCurrentImport(generation);
    setImportStatus(scanProgress.readingStatus);
    let callbacks: ReturnType<typeof createImportProgressCallbacks> | undefined;
    let activity = (): void => undefined;
    const progressPublisher = createSafProgressPublisher(status => {
      ensureCurrentImport(generation);
      setImportStatus(status);
    }, () => Boolean(callbacks?.isActive()) && !generation.controller.signal.aborted, () => activity());

    let result: Awaited<ReturnType<typeof importSongsFromSourcesImpl>>;
    try {
      result = await withImportInactivityTimeout(
        (signal, reportActivity) => {
          activity = reportActivity;
          callbacks = createImportProgressCallbacks({ songs: baselineSongs, signal, parentSignal: generation.controller.signal, activity: reportActivity,
            ...createLibraryScanProgressCallbacks(generation.scanOperationId),
            onApply: update => applyImportedSongsUpdate(update, generation, false),
            onPublish: () => publishImportedSongs(generation) });
          return importSongsFromSourcesImpl({ scanFolders: activeFolders, platformOs, signal,
            onSafProgress: progressPublisher.onProgress,
            onFileProgress: callbacks.onFileProgress, onCheckpoint: callbacks.onCheckpoint,
            existingSongs: baselineSongs, refreshExisting, coverCacheProtection: generation.coverCacheProtection });
        },
        importTimeoutMs,
        scanProgress.timeoutMessage,
        { signal: generation.controller.signal },
        withTimeoutImpl,
      );
    } catch (error) {
      if (progressPublisher.getLatest() && isTimeoutError(error)) {
        console.warn('[Import] SAF scan progress before timeout.', progressPublisher.getLatest());
      }
      throw error;
    } finally {
      callbacks?.close();
    }
    ensureCurrentImport(generation);
    recordLibraryScanResult(generation.scanOperationId, result);
    const resultProgress = getScanImportProgressCopy(activeFolders.length, result.songs.length);
    setImportStatus(resultProgress.foundStatus);
    const scanResult = buildScanImportResult(callbacks?.getSongs() ?? baselineSongs, [...(result.revisionUpdates ?? []), ...result.songs], result.errors, baselineSongs);
    const verificationAlert = getImportVerificationAlert(result, refreshExisting);
    if (scanResult.kind === 'empty') {
      ensureCurrentImport(generation);
      await persistScanFolderUpdates(persistChangedFolderUpdates, result.folderUpdates, generation, importTimeoutMs);
      ensureCurrentImport(generation);
      if (verificationAlert) showAlert(verificationAlert);
      else if (!result.reusedCount || result.errors?.length) showAlert(scanResult.alert);
      return;
    }
    if (verificationAlert) showAlert(verificationAlert);
    else if (scanResult.partialAlert) showAlert(scanResult.partialAlert);
    const acceptedSongs = await applyImportedSongsUpdate(scanResult.update, generation);
    ensureCurrentImport(generation);
    await persistScanFolderUpdates(persistChangedFolderUpdates, result.folderUpdates, generation, importTimeoutMs);
    ensureCurrentImport(generation);
    if (result.songs.length) await prepareLibraryWaveforms(getImportedPreparationSongs(result.songs, acceptedSongs),
      { signal: generation.controller.signal });
  }, [applyImportedSongsUpdate, publishImportedSongs, ensureCurrentImport, importSongsFromSourcesImpl, importTimeoutMs, persistChangedFolderUpdates, platformOs, setImportStatus, showAlert, songs, withTimeoutImpl]);

  return { importFromScanFolders };
};
