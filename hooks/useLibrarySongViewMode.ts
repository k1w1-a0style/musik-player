import { useCallback } from 'react';
import { storage } from '../utils/storage';
import {
  DEFAULT_LIBRARY_SONG_VIEW_MODE,
  getNextLibrarySongViewMode,
  type LibrarySongViewMode,
} from '../utils/libraryViewMode';
import { useHydratedStoredPreference } from './useHydratedStoredPreference';

export interface UseLibrarySongViewModeResult {
  viewMode: LibrarySongViewMode;
  setViewMode: (mode: LibrarySongViewMode) => void;
  cycleViewMode: () => void;
}

const normalizeSongViewMode = (mode: LibrarySongViewMode): LibrarySongViewMode => mode;

export const useLibrarySongViewMode = (): UseLibrarySongViewModeResult => {
  const { value: viewMode, setValue: setViewModeState } = useHydratedStoredPreference({
    defaultValue: DEFAULT_LIBRARY_SONG_VIEW_MODE,
    load: storage.getLibrarySongViewMode,
    persist: storage.setLibrarySongViewMode,
    normalize: normalizeSongViewMode,
    label: 'library-song-view',
  });

  const setViewMode = useCallback((mode: LibrarySongViewMode) => {
    setViewModeState(mode);
  }, [setViewModeState]);

  const cycleViewMode = useCallback(() => {
    setViewModeState(previous => getNextLibrarySongViewMode(previous));
  }, [setViewModeState]);

  return { viewMode, setViewMode, cycleViewMode };
};
