import { useCallback, useEffect, useState } from 'react';
import { storage } from '../utils/storage';
import {
  DEFAULT_LIBRARY_SORT_MODE,
  getNextLibrarySortMode,
  type LibrarySortMode,
} from '../utils/librarySort';

export interface UseLibrarySortModeResult {
  sortMode: LibrarySortMode;
  setSortMode: (mode: LibrarySortMode) => void;
  cycleSortMode: () => void;
}

export const useLibrarySortMode = (): UseLibrarySortModeResult => {
  const [sortMode, setSortModeState] = useState<LibrarySortMode>(DEFAULT_LIBRARY_SORT_MODE);

  useEffect(() => {
    let active = true;
    void storage.getLibrarySortMode().then(stored => {
      if (active) setSortModeState(stored);
    });
    return () => {
      active = false;
    };
  }, []);

  const setSortMode = useCallback((mode: LibrarySortMode) => {
    setSortModeState(mode);
    void storage.setLibrarySortMode(mode);
  }, []);

  const cycleSortMode = useCallback(() => {
    setSortModeState(previous => {
      const next = getNextLibrarySortMode(previous);
      void storage.setLibrarySortMode(next);
      return next;
    });
  }, []);

  return { sortMode, setSortMode, cycleSortMode };
};
