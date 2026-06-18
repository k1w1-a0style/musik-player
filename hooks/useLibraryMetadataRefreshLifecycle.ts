import { useCallback, useRef } from 'react';
import { OperationAbortError, throwIfAborted } from '../utils/withTimeout';
import type { MetadataRefreshGeneration } from './libraryMetadataRefreshActionTypes';

interface UseLibraryMetadataRefreshLifecycleOptions {
  setLoading: (loading: boolean) => void;
  setImportStatus: (status: string | null) => void;
}

interface UseLibraryMetadataRefreshLifecycleResult {
  startRefresh: () => MetadataRefreshGeneration;
  isCurrentRefresh: (generation: MetadataRefreshGeneration) => boolean;
  ensureCurrentRefresh: (generation: MetadataRefreshGeneration) => void;
  finishRefresh: (generation: MetadataRefreshGeneration) => void;
}

export const useLibraryMetadataRefreshLifecycle = ({
  setLoading,
  setImportStatus,
}: UseLibraryMetadataRefreshLifecycleOptions): UseLibraryMetadataRefreshLifecycleResult => {
  const generationRef = useRef(0);
  const activeRefreshRef = useRef<MetadataRefreshGeneration | null>(null);

  const startRefresh = useCallback((): MetadataRefreshGeneration => {
    const previousRefresh = activeRefreshRef.current;
    previousRefresh?.controller.abort(new OperationAbortError('Metadata refresh superseded by a newer refresh'));
    const generation = { controller: new AbortController(), id: generationRef.current + 1 };
    generationRef.current = generation.id;
    activeRefreshRef.current = generation;
    return generation;
  }, []);

  const isCurrentRefresh = useCallback((generation: MetadataRefreshGeneration): boolean =>
    activeRefreshRef.current?.id === generation.id && !generation.controller.signal.aborted,
  []);

  const ensureCurrentRefresh = useCallback((generation: MetadataRefreshGeneration): void => {
    if (!isCurrentRefresh(generation)) {
      throwIfAborted(generation.controller.signal);
      throw new OperationAbortError('Metadata refresh superseded or no longer current');
    }
  }, [isCurrentRefresh]);

  const finishRefresh = useCallback((generation: MetadataRefreshGeneration): void => {
    if (activeRefreshRef.current?.id !== generation.id) return;
    activeRefreshRef.current = null;
    setLoading(false);
    setImportStatus(null);
  }, [setImportStatus, setLoading]);

  return { startRefresh, isCurrentRefresh, ensureCurrentRefresh, finishRefresh };
};
