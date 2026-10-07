import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Song } from '../types/Song';
import type { LibraryTab } from '../utils/libraryTabs';
import type { ImportedSongsStateUpdate, ImportGeneration } from './libraryImportActionTypes';
import { createImportSongReconciler } from '../utils/libraryImportReconciliation';
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
  const reconciliationRef = useRef<{ id: number; merge: ReturnType<typeof createImportSongReconciler> } | null>(null);
  useEffect(() => { confirmedSongsRef.current = songs; }, [songs]);
  const applyImportedSongsUpdate = useCallback((update: ImportedSongsStateUpdate, generation: ImportGeneration) => {
    ensureCurrentImport(generation);
    if (reconciliationRef.current?.id !== generation.id) {
      reconciliationRef.current = { id: generation.id, merge: createImportSongReconciler(update.baselineSongs) };
    }
    // Reconcile only this batch against the current library. A producer's full
    // snapshot may predate unrelated edits, additions or removals.
    const merged = reconciliationRef.current.merge(confirmedSongsRef.current, update.importedSongs);
    protectAcceptedSongCovers(merged);
    setSongs(merged);
    confirmedSongsRef.current = merged;
    ensureCurrentImport(generation);
    setActiveTab(update.activeTab);
    return merged;
  }, [ensureCurrentImport, setActiveTab, setSongs]);

  return { applyImportedSongsUpdate };
};
