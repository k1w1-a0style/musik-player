import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Song } from '../types/Song';
import type { LibraryTab } from '../utils/libraryTabs';
import type { ImportedSongsStateUpdate, ImportGeneration } from './libraryImportActionTypes';
import { mergeSongs } from '../utils/libraryPresentation';
import { protectAcceptedSongCovers } from '../contexts/songCoverProtectionLifecycle';

interface UseLibraryImportStateUpdateOptions {
  songs: Song[];
  setSongs: (songs: Song[]) => void;
  setActiveTab: Dispatch<SetStateAction<LibraryTab>>;
  ensureCurrentImport: (generation: ImportGeneration) => void;
}

export const useLibraryImportStateUpdate = ({
  songs,
  setSongs,
  setActiveTab,
  ensureCurrentImport,
}: UseLibraryImportStateUpdateOptions) => {
  const confirmedSongsRef = useRef(songs);
  const appliedGenerationRef = useRef<number | undefined>(undefined);
  useEffect(() => { confirmedSongsRef.current = songs; }, [songs]);
  const applyImportedSongsUpdate = useCallback((update: ImportedSongsStateUpdate, generation: ImportGeneration) => {
    ensureCurrentImport(generation);
    // A new scan can start before accepted chunk state has rendered back into
    // the hook's props. Keep that chunk as the next scan's merge baseline.
    const merged = appliedGenerationRef.current === generation.id ? update.songs
      : mergeSongs(confirmedSongsRef.current, update.songs);
    protectAcceptedSongCovers(merged);
    setSongs(merged);
    confirmedSongsRef.current = merged;
    appliedGenerationRef.current = generation.id;
    ensureCurrentImport(generation);
    setActiveTab(update.activeTab);
    return merged;
  }, [ensureCurrentImport, setActiveTab, setSongs]);

  return { applyImportedSongsUpdate };
};
