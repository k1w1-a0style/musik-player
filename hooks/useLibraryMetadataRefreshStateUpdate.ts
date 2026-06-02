import { useCallback } from 'react';
import type { Song } from '../types/Song';
import { buildMetadataRefreshResult } from '../utils/libraryImportFlow';
import type { LibraryAlertCopy } from './useLibraryAlerts';
import type { MetadataRefreshGeneration, MetadataRefreshSongsResult } from './libraryMetadataRefreshActionTypes';

interface UseLibraryMetadataRefreshStateUpdateOptions {
  setSongs: (songs: Song[]) => void;
  showAlert: (alert: LibraryAlertCopy) => void;
  ensureCurrentRefresh: (generation: MetadataRefreshGeneration) => void;
}

export const useLibraryMetadataRefreshStateUpdate = ({
  setSongs,
  showAlert,
  ensureCurrentRefresh,
}: UseLibraryMetadataRefreshStateUpdateOptions) => {
  const applyMetadataRefreshResult = useCallback((result: MetadataRefreshSongsResult, generation: MetadataRefreshGeneration): void => {
    ensureCurrentRefresh(generation);
    const refreshResult = buildMetadataRefreshResult(result.songs, result.updated, result.skipped, result.failed);
    if (refreshResult.shouldApplyUpdate) {
      setSongs(refreshResult.songs);
    }
    ensureCurrentRefresh(generation);
    showAlert(refreshResult.alert);
  }, [ensureCurrentRefresh, setSongs, showAlert]);

  return { applyMetadataRefreshResult };
};
