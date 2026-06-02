import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Song } from '../types/Song';
import type { LibraryTab } from '../utils/libraryTabs';
import type { ImportedSongsStateUpdate, ImportGeneration } from './libraryImportActionTypes';

interface UseLibraryImportStateUpdateOptions {
  setSongs: (songs: Song[]) => void;
  setActiveTab: Dispatch<SetStateAction<LibraryTab>>;
  ensureCurrentImport: (generation: ImportGeneration) => void;
}

export const useLibraryImportStateUpdate = ({
  setSongs,
  setActiveTab,
  ensureCurrentImport,
}: UseLibraryImportStateUpdateOptions) => {
  const applyImportedSongsUpdate = useCallback((update: ImportedSongsStateUpdate, generation: ImportGeneration) => {
    ensureCurrentImport(generation);
    setSongs(update.songs);
    ensureCurrentImport(generation);
    setActiveTab(update.activeTab);
  }, [ensureCurrentImport, setActiveTab, setSongs]);

  return { applyImportedSongsUpdate };
};
