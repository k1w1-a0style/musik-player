import type { Song } from '../types/Song';
import { buildImportedSongsUpdate, type ImportedSongsDelta } from './libraryImportFlow';
import type { ImportCheckpoint } from './libraryImportCheckpoint';
import type { ImportFileProgress } from './libraryImportProgress';

export const createImportProgressCallbacks = (options: {
  songs: Song[];
  signal: AbortSignal;
  activity: () => void;
  onApply: (update: ImportedSongsDelta) => Song[] | void;
  onFileProgress: (progress: ImportFileProgress) => void;
}) => {
  let confirmedSongs = options.songs;
  let closed = false;
  const isActive = (): boolean => !closed && !options.signal.aborted;
  return {
    isActive,
    close: (): void => { closed = true; },
    getSongs: (): Song[] => confirmedSongs,
    onFileProgress: (progress: ImportFileProgress): void => {
      if (!isActive()) return;
      options.activity();
      options.onFileProgress(progress);
    },
    onCheckpoint: (checkpoint: ImportCheckpoint): void => {
      if (!isActive()) return;
      const update: ImportedSongsDelta = { importedSongs: checkpoint.songs, baselineSongs: options.songs, activeTab: 'tracks' };
      const accepted = options.onApply(update);
      // The state consumer owns the merge. Build a fallback snapshot only for
      // observers that do not return their accepted state.
      confirmedSongs = accepted ?? buildImportedSongsUpdate(confirmedSongs, checkpoint.songs).songs;
      options.activity();
    },
  };
};
