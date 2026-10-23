import { useCallback } from 'react';
import { OperationAbortError } from '../utils/withTimeout';
import { getImportedPreparationSongs } from '../utils/libraryImportSources';
import type { Dispatch, SetStateAction } from 'react';
import type { Song } from '../types/Song';
import type { LibraryAlertCopy } from './useLibraryAlerts';
import type { confirmLibraryImport } from '../utils/libraryImportConfirmation';
import type { scanMediaLibraryCandidates, enrichMediaLibraryAssets } from '../utils/mediaLibraryImport';
import type {
  ImportGeneration,
  ImportedSongsStateUpdate,
  LibraryImportFlowCopy,
  RequestMediaLibraryPermissions,
  TimeoutRunner,
} from './libraryImportActionTypes';
import {
  buildMediaLibraryCandidatesResult,
  buildMediaLibraryImportResult,
  getMediaLibraryImportProgressCopy,
} from '../utils/libraryImportFlow';
import { withImportInactivityTimeout } from '../utils/libraryImportBudget';
import { getImportVerificationAlert } from '../utils/libraryImportOutcome';
import { createImportProgressCallbacks } from '../utils/libraryImportProgressCallbacks';
import { recordLibraryScanResult } from '../utils/libraryScanOperation';
import { createLibraryScanProgressCallbacks } from '../utils/libraryScanProgress';
import { ensureAudioReadAccess } from '../utils/mediaLibraryReadAccess';

interface UseLibraryMediaLibraryImportFlowOptions {
  songs: Song[];
  setImportStatus: Dispatch<SetStateAction<string | null>>;
  showAlert: (alert: LibraryAlertCopy) => void;
  importTimeoutMs: number;
  requestMediaLibraryPermissionsAsync: RequestMediaLibraryPermissions;
  getMediaLibraryPermissionsAsync: RequestMediaLibraryPermissions;
  scanMediaLibraryCandidatesImpl: typeof scanMediaLibraryCandidates;
  enrichMediaLibraryAssetsImpl: typeof enrichMediaLibraryAssets;
  confirmLibraryImportImpl: typeof confirmLibraryImport;
  withTimeoutImpl: TimeoutRunner;
  ensureCurrentImport: (generation: ImportGeneration) => void;
  applyImportedSongsUpdate: (update: ImportedSongsStateUpdate, generation: ImportGeneration, publish?: boolean) => Promise<Song[]>;
  publishImportedSongs: (generation: ImportGeneration) => Song[];
}

export const useLibraryMediaLibraryImportFlow = ({
  songs,
  setImportStatus,
  showAlert,
  importTimeoutMs,
  requestMediaLibraryPermissionsAsync,
  getMediaLibraryPermissionsAsync,
  scanMediaLibraryCandidatesImpl,
  enrichMediaLibraryAssetsImpl,
  confirmLibraryImportImpl,
  withTimeoutImpl,
  ensureCurrentImport,
  applyImportedSongsUpdate, publishImportedSongs,
}: UseLibraryMediaLibraryImportFlowOptions) => {
  const importFromMediaLibrary = useCallback(async (importCopy: LibraryImportFlowCopy, generation: ImportGeneration,
    refreshExisting = false, baselineSongs = songs): Promise<Song[]> => {
    ensureCurrentImport(generation);
    setImportStatus('Musikzugriff wird geprüft… Für den Scan wird nur Lesezugriff auf Musik benötigt.');
    await withTimeoutImpl(signal => ensureAudioReadAccess(requestMediaLibraryPermissionsAsync,
      getMediaLibraryPermissionsAsync, signal), importTimeoutMs,
    'Musikzugriff konnte nicht rechtzeitig bestätigt werden. Bitte den Scan erneut starten oder einen Musikordner auswählen.',
    { signal: generation.controller.signal });
    ensureCurrentImport(generation);
    setImportStatus(importCopy.scanningMediaLibraryStatus);
    const candidates = await withImportInactivityTimeout(
      (signal, activity) => scanMediaLibraryCandidatesImpl({ signal,
        onProgress: assetCount => {
          if (signal.aborted) return;
          ensureCurrentImport(generation);
          activity();
          setImportStatus(`Medienbibliothek wird gelesen… ${assetCount} Titel gefunden`);
        } }),
      importTimeoutMs,
      importCopy.mediaLibraryScanTimeoutMessage,
      { signal: generation.controller.signal },
      withTimeoutImpl,
    );
    ensureCurrentImport(generation);
    const candidateProgress = getMediaLibraryImportProgressCopy(candidates.assets.length, 0);
    setImportStatus(candidateProgress.candidatesFoundStatus);
    const candidateResult = buildMediaLibraryCandidatesResult(candidates.assets.length);
    if (candidateResult.kind === 'empty') {
      showAlert(candidateResult.alert);
      return [];
    }
    const shouldImport = await confirmLibraryImportImpl(candidates.assets.length, candidates.skipped.length);
    ensureCurrentImport(generation);
    if (!shouldImport) throw new OperationAbortError('Musikimport abgebrochen.');
    setImportStatus(importCopy.importingMetadataAndCoversStatus);
    let callbacks: ReturnType<typeof createImportProgressCallbacks> | undefined;
    let mediaResult: Awaited<ReturnType<typeof enrichMediaLibraryAssetsImpl>>;
    try {
      mediaResult = await withImportInactivityTimeout((signal, activity) => {
        callbacks = createImportProgressCallbacks({ songs: baselineSongs, signal, parentSignal: generation.controller.signal, activity,
          onApply: update => applyImportedSongsUpdate(update, generation, false),
          onPublish: () => publishImportedSongs(generation),
          ...createLibraryScanProgressCallbacks(generation.scanOperationId) });
        return enrichMediaLibraryAssetsImpl(candidates.assets, candidates.skipped.length, {
          signal, existingSongs: baselineSongs, refreshExisting,
          coverCacheProtection: generation.coverCacheProtection,
          onFileProgress: callbacks.onFileProgress, onCheckpoint: callbacks.onCheckpoint,
        });
      }, importTimeoutMs, importCopy.metadataImportTimeoutMessage,
      { signal: generation.controller.signal }, withTimeoutImpl);
    } finally {
      callbacks?.close();
    }
    ensureCurrentImport(generation);
    recordLibraryScanResult(generation.scanOperationId, mediaResult);
    const mediaProgress = getMediaLibraryImportProgressCopy(candidates.assets.length, mediaResult.songs.length);
    setImportStatus(mediaProgress.savingStatus);
    const result = buildMediaLibraryImportResult(callbacks?.getSongs() ?? baselineSongs, [...(mediaResult.revisionUpdates ?? []), ...mediaResult.songs], baselineSongs);
    const acceptedSongs = await applyImportedSongsUpdate(result.update, generation);
    const verificationAlert = getImportVerificationAlert(mediaResult, refreshExisting);
    if (verificationAlert) showAlert(verificationAlert);
    return getImportedPreparationSongs(mediaResult.songs, acceptedSongs);
  }, [applyImportedSongsUpdate, publishImportedSongs, confirmLibraryImportImpl, ensureCurrentImport, enrichMediaLibraryAssetsImpl, importTimeoutMs, requestMediaLibraryPermissionsAsync, getMediaLibraryPermissionsAsync, scanMediaLibraryCandidatesImpl, setImportStatus, showAlert, songs, withTimeoutImpl]);
  return { importFromMediaLibrary };
};
