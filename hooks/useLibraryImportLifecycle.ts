import { useCallback, useRef } from 'react';
import { OperationAbortError, throwIfAborted } from '../utils/withTimeout';
import type { ImportGeneration } from './libraryImportActionTypes';

interface UseLibraryImportLifecycleOptions {
  setLoading: (loading: boolean) => void;
  setImportStatus: (status: string | null) => void;
}

interface UseLibraryImportLifecycleResult {
  startImport: () => ImportGeneration;
  isCurrentImport: (generation: ImportGeneration) => boolean;
  ensureCurrentImport: (generation: ImportGeneration) => void;
  finishImport: (generation: ImportGeneration) => void;
}

export const useLibraryImportLifecycle = ({
  setLoading,
  setImportStatus,
}: UseLibraryImportLifecycleOptions): UseLibraryImportLifecycleResult => {
  const generationRef = useRef(0);
  const activeImportRef = useRef<ImportGeneration | null>(null);

  const startImport = useCallback((): ImportGeneration => {
    const previousImport = activeImportRef.current;
    previousImport?.controller.abort(new OperationAbortError('Import superseded by a newer import'));
    const generation = { controller: new AbortController(), id: generationRef.current + 1 };
    generationRef.current = generation.id;
    activeImportRef.current = generation;
    return generation;
  }, []);

  const isCurrentImport = useCallback((generation: ImportGeneration): boolean =>
    activeImportRef.current?.id === generation.id && !generation.controller.signal.aborted,
  []);

  const ensureCurrentImport = useCallback((generation: ImportGeneration): void => {
    if (!isCurrentImport(generation)) throwIfAborted(generation.controller.signal);
  }, [isCurrentImport]);

  const finishImport = useCallback((generation: ImportGeneration): void => {
    if (activeImportRef.current?.id !== generation.id) return;
    activeImportRef.current = null;
    setLoading(false);
    setImportStatus(null);
  }, [setImportStatus, setLoading]);

  return { startImport, isCurrentImport, ensureCurrentImport, finishImport };
};
