import { useCallback } from 'react';
import type { Song } from '../types/Song';
import type { SongMetadataPatchesById } from '../contexts/useLibraryActions';
import { buildMetadataRefreshResult } from '../utils/libraryImportFlow';
import type { LibraryAlertCopy } from './useLibraryAlerts';
import type { MetadataRefreshGeneration, MetadataRefreshSongsResult } from './libraryMetadataRefreshActionTypes';

interface UseLibraryMetadataRefreshStateUpdateOptions {
  setSongs: (songs: Song[]) => void;
  showAlert: (alert: LibraryAlertCopy) => void;
  ensureCurrentRefresh: (generation: MetadataRefreshGeneration) => void;
  applySongMetadataPatches?: (patchesBySongId: SongMetadataPatchesById) => void;
}

export const useLibraryMetadataRefreshStateUpdate = ({
  setSongs,
  showAlert,
  ensureCurrentRefresh,
  applySongMetadataPatches,
}: UseLibraryMetadataRefreshStateUpdateOptions) => {
  const applyMetadataRefreshResult = useCallback((result: MetadataRefreshSongsResult, generation: MetadataRefreshGeneration): void => {
    ensureCurrentRefresh(generation);
    const refreshResult = buildMetadataRefreshResult(result.songs, result.updated, result.skipped, result.failed);
    if (refreshResult.shouldApplyUpdate) {
      if (applySongMetadataPatches && Object.keys(result.patchesBySongId ?? {}).length > 0) {
        applySongMetadataPatches(result.patchesBySongId ?? {});
      } else {
        setSongs(refreshResult.songs);
      }
    }
    ensureCurrentRefresh(generation);
    showAlert(refreshResult.alert);
  }, [applySongMetadataPatches, ensureCurrentRefresh, setSongs, showAlert]);

  return { applyMetadataRefreshResult };
};
