import { useCallback, useEffect, useState } from 'react';
import { storage } from '../utils/storage';
import {
  DEFAULT_LIBRARY_SONG_VIEW_MODE,
  getNextLibrarySongViewMode,
  type LibrarySongViewMode,
} from '../utils/libraryViewMode';

export interface UseLibrarySongViewModeResult {
  viewMode: LibrarySongViewMode;
  setViewMode: (mode: LibrarySongViewMode) => void;
  cycleViewMode: () => void;
}

export const useLibrarySongViewMode = (): UseLibrarySongViewModeResult => {
  const [viewMode, setViewModeState] = useState<LibrarySongViewMode>(DEFAULT_LIBRARY_SONG_VIEW_MODE);

  useEffect(() => {
    let active = true;
    void storage.getLibrarySongViewMode().then(stored => {
      if (active) setViewModeState(stored);
    });
    return () => {
      active = false;
    };
  }, []);

  const setViewMode = useCallback((mode: LibrarySongViewMode) => {
    setViewModeState(mode);
    void storage.setLibrarySongViewMode(mode);
  }, []);

  const cycleViewMode = useCallback(() => {
    setViewModeState(previous => {
      const next = getNextLibrarySongViewMode(previous);
      void storage.setLibrarySongViewMode(next);
      return next;
    });
  }, []);

  return { viewMode, setViewMode, cycleViewMode };
};
