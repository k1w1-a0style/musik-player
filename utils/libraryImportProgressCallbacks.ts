import type { Song } from '../types/Song';
import { buildImportedSongsUpdate } from './libraryImportFlow';
import type { ImportCheckpoint } from './libraryImportCheckpoint';
import type { ImportFileProgress } from './libraryImportProgress';

export const createImportProgressCallbacks = (options: {
  songs: Song[];
  signal: AbortSignal;
  activity: () => void;
  onApply: (update: ReturnType<typeof buildImportedSongsUpdate>) => Song[] | void;
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
      const update = buildImportedSongsUpdate(confirmedSongs, checkpoint.songs);
      const accepted = options.onApply(update);
      confirmedSongs = accepted ?? update.songs;
      options.activity();
    },
  };
};
