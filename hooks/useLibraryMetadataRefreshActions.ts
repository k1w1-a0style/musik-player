import { useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Song } from '../types/Song';
import type { LibraryAlertCopy } from './useLibraryAlerts';
import { refreshSongsFromId3 } from '../utils/songMetadataRefresh';
import { withTimeout } from '../utils/withTimeout';
import {
  buildMetadataRefreshAvailabilityResult,
  buildMetadataRefreshResult,
  getMetadataRefreshFlowCopy,
  getMetadataUpdateStoppedAlert,
} from '../utils/libraryImportFlow';

type MetadataRefreshFlowCopy = ReturnType<typeof getMetadataRefreshFlowCopy>;
type TimeoutRunner = <T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string) => Promise<T>;

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

const DEFAULT_IMPORT_TIMEOUT_MS = 90_000;

export const useLibraryMetadataRefreshActions = ({
  songs,
  setSongs,
  setMenuOpen,
  setLoading,
  setImportStatus,
  showAlert,
  importTimeoutMs = DEFAULT_IMPORT_TIMEOUT_MS,
  refreshSongsFromId3Impl = refreshSongsFromId3,
  withTimeoutImpl = withTimeout,
}: UseLibraryMetadataRefreshActionsOptions): UseLibraryMetadataRefreshActionsResult => {
  const refreshInFlightRef = useRef(false);

  const runMetadataRefresh = useCallback(async (refreshCopy: MetadataRefreshFlowCopy): Promise<void> => {
    setImportStatus(refreshCopy.readingStatus);
    const result = await withTimeoutImpl(refreshSongsFromId3Impl(songs), importTimeoutMs, refreshCopy.timeoutMessage);
    const refreshResult = buildMetadataRefreshResult(result.songs, result.updated, result.skipped, result.failed);
    if (refreshResult.shouldApplyUpdate) setSongs(refreshResult.songs);
    showAlert(refreshResult.alert);
  }, [importTimeoutMs, refreshSongsFromId3Impl, setImportStatus, setSongs, showAlert, songs, withTimeoutImpl]);

  const refreshMetadataFromFiles = useCallback(async (): Promise<void> => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    setMenuOpen(false);
    const availabilityResult = buildMetadataRefreshAvailabilityResult(songs.length);
    if (availabilityResult.kind === 'empty') {
      refreshInFlightRef.current = false;
      showAlert(availabilityResult.alert);
      return;
    }

    const refreshCopy = getMetadataRefreshFlowCopy();
    try {
      setLoading(true);
      await runMetadataRefresh(refreshCopy);
    } catch (error) {
      const stoppedAlert = getMetadataUpdateStoppedAlert(error);
      showAlert(stoppedAlert);
    } finally {
      refreshInFlightRef.current = false;
      setLoading(false);
      setImportStatus(null);
    }
  }, [runMetadataRefresh, setImportStatus, setLoading, setMenuOpen, showAlert, songs.length]);

  return { refreshMetadataFromFiles };
};
