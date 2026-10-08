import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Song } from '../types/Song';
import type { LibraryTab } from '../utils/libraryTabs';
import type { ImportedSongsStateUpdate, ImportGeneration } from './libraryImportActionTypes';
import type { SongImportController } from '../contexts/songLibraryState';

interface UseLibraryImportStateUpdateOptions {
  songs: Song[];
  setSongs: (songs: Song[]) => void;
  setActiveTab: Dispatch<SetStateAction<LibraryTab>>;
  ensureCurrentImport: (generation: ImportGeneration) => void;
  songImport?: SongImportController;
}

export const useLibraryImportStateUpdate = ({
  setActiveTab,
  ensureCurrentImport,
  songImport,
}: UseLibraryImportStateUpdateOptions) => {
  const publishImportedSongs = useCallback((generation: ImportGeneration): Song[] => {
    ensureCurrentImport(generation);
    if (!songImport) throw new Error('Bibliothek ist noch nicht bereit. Bitte den Import erneut starten.');
    const visible = songImport.publishImport();
    setActiveTab('tracks');
    return visible;
  }, [ensureCurrentImport, setActiveTab, songImport]);
  const applyImportedSongsUpdate = useCallback(async (update: ImportedSongsStateUpdate,
    generation: ImportGeneration, publish = true): Promise<Song[]> => {
    ensureCurrentImport(generation);
    if (!songImport) throw new Error('Bibliothek ist noch nicht bereit. Bitte den Import erneut starten.');
    const accepted = await songImport.commitImport(update, generation);
    ensureCurrentImport(generation);
    if (publish) publishImportedSongs(generation);
    return accepted;
  }, [ensureCurrentImport, publishImportedSongs, songImport]);
  return { applyImportedSongsUpdate, publishImportedSongs };
};
