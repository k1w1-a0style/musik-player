import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Song } from '../types/Song';
import { getMetadataRefreshFlowCopy } from '../utils/libraryImportFlow';
import type { refreshSongsFromId3 } from '../utils/songMetadataRefresh';
import type { MetadataRefreshGeneration, MetadataRefreshSongsResult, TimeoutRunner } from './libraryMetadataRefreshActionTypes';

interface UseLibraryMetadataRefreshRunnerOptions {
  songs: Song[];
  setImportStatus: Dispatch<SetStateAction<string | null>>;
  importTimeoutMs: number;
  refreshSongsFromId3Impl: typeof refreshSongsFromId3;
  withTimeoutImpl: TimeoutRunner;
  ensureCurrentRefresh: (generation: MetadataRefreshGeneration) => void;
}

export const useLibraryMetadataRefreshRunner = ({
  songs,
  setImportStatus,
  importTimeoutMs,
  refreshSongsFromId3Impl,
  withTimeoutImpl,
  ensureCurrentRefresh,
}: UseLibraryMetadataRefreshRunnerOptions) => {
  const runMetadataRefresh = useCallback(async (generation: MetadataRefreshGeneration): Promise<MetadataRefreshSongsResult> => {
    const refreshCopy = getMetadataRefreshFlowCopy();
    setImportStatus(refreshCopy.readingStatus);
    const result = await withTimeoutImpl(
      signal => refreshSongsFromId3Impl(songs, { signal }),
      importTimeoutMs,
      refreshCopy.timeoutMessage,
      { signal: generation.controller.signal },
    );
    ensureCurrentRefresh(generation);
    return result;
  }, [ensureCurrentRefresh, importTimeoutMs, refreshSongsFromId3Impl, setImportStatus, songs, withTimeoutImpl]);

  return { runMetadataRefresh };
};
