import { useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Song } from '../types/Song';
import { refreshSongsFromId3 } from '../utils/songMetadataRefresh';
import { OperationAbortError, isAbortError, isTimeoutError, throwIfAborted, withTimeout, type CancellableOperation, type TimeoutOptions } from '../utils/withTimeout';
import type { LibraryAlertCopy } from './useLibraryAlerts';
import {
  buildMetadataRefreshAvailabilityResult,
  buildMetadataRefreshResult,
  getMetadataRefreshFlowCopy,
  getMetadataUpdateStoppedAlert,
} from '../utils/libraryImportFlow';

interface RefreshGeneration {
  controller: AbortController;
  id: number;
}

type TimeoutRunner = <T>(operation: Promise<T> | CancellableOperation<T>, timeoutMs: number, timeoutMessage: string, options?: TimeoutOptions) => Promise<T>;

export interface UseLibraryMetadataRefreshActionsOptions {
  songs: Song[];
  setSongs: (songs: Song[]) => void;
  setMenuOpen: Dispatch<SetStateAction<boolean>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setImportStatus: Dispatch<SetStateAction<string | null>>;
  showAlert: (alert: LibraryAlertCopy) => void;
  importTimeoutMs?: number;
  refreshSongsFromId3Impl?: typeof refreshSongsFromId3;
  withTimeoutImpl?: TimeoutRunner;
}

export interface UseLibraryMetadataRefreshActionsResult {
  refreshMetadataFromFiles: () => Promise<void>;
}

export const useLibraryMetadataRefreshActions = ({
  songs,
  setSongs,
  setMenuOpen,
  setLoading,
  setImportStatus,
  showAlert,
  importTimeoutMs = 90_000,
  refreshSongsFromId3Impl = refreshSongsFromId3,
  withTimeoutImpl = withTimeout,
}: UseLibraryMetadataRefreshActionsOptions): UseLibraryMetadataRefreshActionsResult => {
  const generationRef = useRef(0);
  const activeRefreshRef = useRef<RefreshGeneration | null>(null);

  const isCurrentRefresh = useCallback((generation: RefreshGeneration): boolean =>
    activeRefreshRef.current?.id === generation.id && !generation.controller.signal.aborted,
  []);

  const ensureCurrentRefresh = useCallback((generation: RefreshGeneration): void => {
    if (!isCurrentRefresh(generation)) throwIfAborted(generation.controller.signal);
  }, [isCurrentRefresh]);

  const refreshMetadataFromFiles = useCallback(async (): Promise<void> => {
    setMenuOpen(false);
    const availability = buildMetadataRefreshAvailabilityResult(songs.length);
    if (availability.kind === 'empty') {
      showAlert(availability.alert);
      return;
    }

    const previousRefresh = activeRefreshRef.current;
    previousRefresh?.controller.abort(new OperationAbortError('Metadata refresh superseded by a newer refresh'));
    const generation = { controller: new AbortController(), id: generationRef.current + 1 };
    generationRef.current = generation.id;
    activeRefreshRef.current = generation;
    const refreshCopy = getMetadataRefreshFlowCopy();

    setLoading(true);
    try {
      setImportStatus(refreshCopy.readingStatus);
      const result = await withTimeoutImpl(
        signal => refreshSongsFromId3Impl(songs, { signal }),
        importTimeoutMs,
        refreshCopy.timeoutMessage,
        { signal: generation.controller.signal },
      );
      ensureCurrentRefresh(generation);
      const refreshResult = buildMetadataRefreshResult(result.songs, result.updated, result.skipped, result.failed);
      if (refreshResult.shouldApplyUpdate) {
        setSongs(refreshResult.songs);
      }
      ensureCurrentRefresh(generation);
      showAlert(refreshResult.alert);
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
      if (activeRefreshRef.current?.id === generation.id) {
        activeRefreshRef.current = null;
        setLoading(false);
        setImportStatus(null);
      }
    }
  }, [ensureCurrentRefresh, importTimeoutMs, isCurrentRefresh, refreshSongsFromId3Impl, setImportStatus, setLoading, setMenuOpen, setSongs, showAlert, songs, withTimeoutImpl]);

  return { refreshMetadataFromFiles };
};
