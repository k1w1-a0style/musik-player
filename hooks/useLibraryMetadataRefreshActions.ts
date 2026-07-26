import { useCallback } from 'react';
import { refreshSongsFromId3 } from '../utils/songMetadataRefresh';
import { MANUAL_METADATA_REFRESH_SOFT_BUDGET_MS } from '../utils/libraryOperationTimeouts';
import { beginMetadataRefreshActivity, endMetadataRefreshActivity } from '../utils/metadataRefreshActivity';
import { completeMetadataRefreshOperation } from '../utils/metadataRefreshOperation';
import { isAbortError, isTimeoutError, withTimeout } from '../utils/withTimeout';
import {
  buildMetadataRefreshAvailabilityResult,
  getMetadataUpdateStoppedAlert,
} from '../utils/libraryImportFlow';
import type {
  UseLibraryMetadataRefreshActionsOptions,
  UseLibraryMetadataRefreshActionsResult,
} from './libraryMetadataRefreshActionTypes';
import { useLibraryMetadataRefreshLifecycle } from './useLibraryMetadataRefreshLifecycle';
import { useLibraryMetadataRefreshRunner } from './useLibraryMetadataRefreshRunner';
import { useLibraryMetadataRefreshStateUpdate } from './useLibraryMetadataRefreshStateUpdate';

export type {
  UseLibraryMetadataRefreshActionsOptions,
  UseLibraryMetadataRefreshActionsResult,
} from './libraryMetadataRefreshActionTypes';

export const useLibraryMetadataRefreshActions = ({
  songs,
  setSongs,
  setMenuOpen,
  setLoading,
  setImportStatus,
  showAlert,
  applySongMetadataPatches,
  importTimeoutMs = MANUAL_METADATA_REFRESH_SOFT_BUDGET_MS,
  refreshSongsFromId3Impl = refreshSongsFromId3,
  withTimeoutImpl = withTimeout,
}: UseLibraryMetadataRefreshActionsOptions): UseLibraryMetadataRefreshActionsResult => {
  const {
    startRefresh,
    isCurrentRefresh,
    ownsRefresh,
    ensureCurrentRefresh,
    finishRefresh,
    cancelRefresh,
    isRefreshActive,
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
    // Prioritize the manual refresh: pause background cover/audio-info backfills
    // so they do not compete for native SAF/tag IO while the user-triggered scan runs.
    beginMetadataRefreshActivity();
    try {
      const result = await runMetadataRefresh(generation);
      if (!result.completed) {
        console.warn(`[LibraryRefresh] Metadata refresh timed out after ${Math.round(importTimeoutMs / 1000)}s. processed=${result.processed}/${result.total} updated=${result.updated} skipped=${result.skipped} failed=${result.failed} lastSongId=${result.lastProcessedSongId ?? 'none'} partialApplied=${Object.keys(result.patchesBySongId ?? {}).length > 0}`);
      }
      if (result.failed > 0 && (result.errorDetails?.length ?? 0) > 0) {
        console.warn(`[LibraryRefresh] ${result.failed} track(s) could not be read:`, result.errorDetails);
      }
      applyMetadataRefreshResult(result, generation);
      completeMetadataRefreshOperation(result.completed ? 'completed' : 'resumable');
    } catch (error) {
      if (isTimeoutError(error)) {
        console.warn('[LibraryRefresh] Metadata refresh timed out.', error);
        console.warn(`[LibraryRefresh] Metadata refresh timed out after ${Math.round(importTimeoutMs / 1000)}s. processed=0/${songs.length} updated=0 skipped=0 failed=0 lastSongId=none partialApplied=false`, error);
        if (ownsRefresh(generation)) completeMetadataRefreshOperation('resumable');
      } else if (!isCurrentRefresh(generation) || isAbortError(error)) {
        console.warn('[LibraryRefresh] Metadata refresh cancelled.', error);
        if (ownsRefresh(generation)) completeMetadataRefreshOperation('cancelled');
        return;
      } else {
        console.warn('[LibraryRefresh] Metadata refresh failed.', error);
        if (ownsRefresh(generation)) completeMetadataRefreshOperation('failed');
      }
      showAlert(getMetadataUpdateStoppedAlert(error));
    } finally {
      endMetadataRefreshActivity();
      finishRefresh(generation);
    }
  }, [applyMetadataRefreshResult, finishRefresh, importTimeoutMs, isCurrentRefresh, ownsRefresh, runMetadataRefresh, setLoading, setMenuOpen, showAlert, songs.length, startRefresh]);

  return {
    refreshMetadataFromFiles,
    cancelRefresh,
    resumeMetadataRefresh: refreshMetadataFromFiles,
    isRefreshActive,
  };
};
