import { useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Song } from '../types/Song';
import type { LibraryTab } from '../utils/libraryTabs';
import type { ImportedSongsStateUpdate, ImportGeneration } from './libraryImportActionTypes';
import type { SongImportController } from '../contexts/songLibraryState';
import { withTimeout } from '../utils/withTimeout';
import { DEFAULT_LIBRARY_OPERATION_TIMEOUT_MS } from '../utils/libraryOperationTimeouts';

interface UseLibraryImportStateUpdateOptions {
  songs: Song[];
  setSongs: (songs: Song[]) => void;
  setActiveTab: Dispatch<SetStateAction<LibraryTab>>;
  ensureCurrentImport: (generation: ImportGeneration) => void;
  songImport?: SongImportController;
  timeoutMs?: number;
}

export const useLibraryImportStateUpdate = ({
  setActiveTab,
  ensureCurrentImport,
  songImport,
  timeoutMs = DEFAULT_LIBRARY_OPERATION_TIMEOUT_MS,
}: UseLibraryImportStateUpdateOptions) => {
  const publishedGenerations = useRef(new WeakSet<ImportGeneration>());
  const publishImportedSongs = useCallback((generation: ImportGeneration): Song[] => {
    ensureCurrentImport(generation);
    if (!songImport) throw new Error('Bibliothek ist noch nicht bereit. Bitte den Import erneut starten.');
    const visible = songImport.publishImport();
    // Show confirmed results once. Later checkpoints must not steal navigation
    // from a user editing a playlist while this same import is still running.
    if (!publishedGenerations.current.has(generation)) {
      publishedGenerations.current.add(generation);
      setActiveTab('tracks');
    }
    return visible;
  }, [ensureCurrentImport, setActiveTab, songImport]);
  const applyImportedSongsUpdate = useCallback(async (update: ImportedSongsStateUpdate,
    generation: ImportGeneration, publish = true): Promise<Song[]> => {
    ensureCurrentImport(generation);
    if (!songImport) throw new Error('Bibliothek ist noch nicht bereit. Bitte den Import erneut starten.');
    // Bound this observer, while the durable writer and checkpoint barrier
    // retain ownership until the actual storage operation settles.
    const accepted = await withTimeout(() => songImport.commitImport(update, generation), timeoutMs,
      'Bibliothek wird noch gespeichert. Bitte nach Abschluss erneut versuchen.',
      { signal: generation.controller.signal });
    ensureCurrentImport(generation);
    if (publish) publishImportedSongs(generation);
    return accepted;
  }, [ensureCurrentImport, publishImportedSongs, songImport, timeoutMs]);
  return { applyImportedSongsUpdate, publishImportedSongs };
};
