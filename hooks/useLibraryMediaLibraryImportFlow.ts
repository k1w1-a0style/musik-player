import { useCallback } from 'react';
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
  buildMediaLibraryPermissionResult,
  getMediaLibraryImportProgressCopy,
} from '../utils/libraryImportFlow';

interface UseLibraryMediaLibraryImportFlowOptions {
  songs: Song[];
  setImportStatus: Dispatch<SetStateAction<string | null>>;
  showAlert: (alert: LibraryAlertCopy) => void;
  importTimeoutMs: number;
  requestMediaLibraryPermissionsAsync: RequestMediaLibraryPermissions;
  scanMediaLibraryCandidatesImpl: typeof scanMediaLibraryCandidates;
  enrichMediaLibraryAssetsImpl: typeof enrichMediaLibraryAssets;
  confirmLibraryImportImpl: typeof confirmLibraryImport;
  withTimeoutImpl: TimeoutRunner;
  ensureCurrentImport: (generation: ImportGeneration) => void;
  applyImportedSongsUpdate: (update: ImportedSongsStateUpdate, generation: ImportGeneration) => void;
}

export const useLibraryMediaLibraryImportFlow = ({
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
}: UseLibraryMediaLibraryImportFlowOptions) => {
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

  return { importFromMediaLibrary };
};
