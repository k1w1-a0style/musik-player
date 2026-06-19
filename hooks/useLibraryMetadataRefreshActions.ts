import { useCallback } from 'react';
import { refreshSongsFromId3 } from '../utils/songMetadataRefresh';
import { DEFAULT_LIBRARY_OPERATION_TIMEOUT_MS } from '../utils/libraryOperationTimeouts';
import { isAbortError, isTimeoutError, withTimeout } from '../utils/withTimeout';
import {
  buildMetadataRefreshAvailabilityResult,
  getMetadataUpdateStoppedAlert,
} from '../utils/libraryImportFlow';
import type { UseLibraryMetadataRefreshActionsOptions, UseLibraryMetadataRefreshActionsResult } from './libraryMetadataRefreshActionTypes';
import { useLibraryMetadataRefreshLifecycle } from './useLibraryMetadataRefreshLifecycle';
import { useLibraryMetadataRefreshRunner } from './useLibraryMetadataRefreshRunner';
import { useLibraryMetadataRefreshStateUpdate } from './useLibraryMetadataRefreshStateUpdate';

export type { UseLibraryMetadataRefreshActionsOptions, UseLibraryMetadataRefreshActionsResult } from './libraryMetadataRefreshActionTypes';

export const useLibraryMetadataRefreshActions = ({
  songs,
  setSongs,
  setMenuOpen,
  setLoading,
  setImportStatus,
  showAlert,
  applySongMetadataPatches,
  importTimeoutMs = DEFAULT_LIBRARY_OPERATION_TIMEOUT_MS,
  refreshSongsFromId3Impl = refreshSongsFromId3,
  withTimeoutImpl = withTimeout,
}: UseLibraryMetadataRefreshActionsOptions): UseLibraryMetadataRefreshActionsResult => {
  const {
    startRefresh,
    isCurrentRefresh,
    ensureCurrentRefresh,
    finishRefresh,
  } = useLibraryMetadataRefreshLifecycle({ setLoading, setImportStatus });
  const { runMetadataRefresh, commitMetadataRefreshProgress } = useLibraryMetadataRefreshRunner({
    songs,
    setImportStatus,
    importTimeoutMs,
    refreshSongsFromId3Impl,
    withTimeoutImpl,
    ensureCurrentRefresh,
  });
  const { applyMetadataRefreshResult } = useLibraryMetadataRefreshStateUpdate({
    setSongs,
    showAlert,
    ensureCurrentRefresh,
    applySongMetadataPatches,
    commitMetadataRefreshProgress,
  });

  const refreshMetadataFromFiles = useCallback(async (): Promise<void> => {
    setMenuOpen(false);
    const availability = buildMetadataRefreshAvailabilityResult(songs.length);
    if (availability.kind === 'empty') {
      showAlert(availability.alert);
      return;
    }

    const generation = startRefresh();
    setLoading(true);
    try {
      const result = await runMetadataRefresh(generation);
      if (!result.completed) {
        console.warn(`[LibraryRefresh] Metadata refresh timed out after ${Math.round(importTimeoutMs / 1000)}s. processed=${result.processed}/${result.total} updated=${result.updated} skipped=${result.skipped} failed=${result.failed} lastSongId=${result.lastProcessedSongId ?? 'none'} partialApplied=${Object.keys(result.patchesBySongId ?? {}).length > 0}`);
      }
      applyMetadataRefreshResult(result, generation);
    } catch (error) {
      if (isTimeoutError(error)) {
        console.warn('[LibraryRefresh] Metadata refresh timed out.', error);
        console.warn(`[LibraryRefresh] Metadata refresh timed out after ${Math.round(importTimeoutMs / 1000)}s. processed=0/${songs.length} updated=0 skipped=0 failed=0 lastSongId=none partialApplied=false`, error);
      } else if (!isCurrentRefresh(generation) || isAbortError(error)) {
        console.warn('[LibraryRefresh] Metadata refresh cancelled.', error);
        return;
      } else {
        console.warn('[LibraryRefresh] Metadata refresh failed.', error);
      }
      showAlert(getMetadataUpdateStoppedAlert(error));
    } finally {
      finishRefresh(generation);
    }
  }, [applyMetadataRefreshResult, finishRefresh, importTimeoutMs, isCurrentRefresh, runMetadataRefresh, setLoading, setMenuOpen, showAlert, songs.length, startRefresh]);

  return { refreshMetadataFromFiles };
};
