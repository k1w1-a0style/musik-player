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
  const { runMetadataRefresh } = useLibraryMetadataRefreshRunner({
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
      applyMetadataRefreshResult(result, generation);
    } catch (error) {
      if (isTimeoutError(error)) {
        console.warn('[LibraryRefresh] Metadata refresh timed out.', error);
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
  }, [applyMetadataRefreshResult, finishRefresh, isCurrentRefresh, runMetadataRefresh, setLoading, setMenuOpen, showAlert, songs.length, startRefresh]);

  return { refreshMetadataFromFiles };
};
