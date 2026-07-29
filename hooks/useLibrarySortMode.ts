import { useCallback } from 'react';
import { storage } from '../utils/storage';
import {
  DEFAULT_LIBRARY_SORT_MODE,
  getNextLibrarySortMode,
  type LibrarySortMode,
} from '../utils/librarySort';
import { useHydratedStoredPreference } from './useHydratedStoredPreference';

export interface UseLibrarySortModeResult {
  sortMode: LibrarySortMode;
  setSortMode: (mode: LibrarySortMode) => void;
  cycleSortMode: () => void;
}

const normalizeSortMode = (mode: LibrarySortMode): LibrarySortMode => mode;

export const useLibrarySortMode = (): UseLibrarySortModeResult => {
  const { value: sortMode, setValue: setSortModeState } = useHydratedStoredPreference({
    defaultValue: DEFAULT_LIBRARY_SORT_MODE,
    load: storage.getLibrarySortMode,
    persist: storage.setLibrarySortMode,
    normalize: normalizeSortMode,
    label: 'library-sort',
  });

  const setSortMode = useCallback((mode: LibrarySortMode) => {
    setSortModeState(mode);
  }, [setSortModeState]);

  const cycleSortMode = useCallback(() => {
    setSortModeState(previous => getNextLibrarySortMode(previous));
  }, [setSortModeState]);

  return { sortMode, setSortMode, cycleSortMode };
};
