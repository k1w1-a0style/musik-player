import type { Song } from '../types/Song';
import { buildImportedSongsUpdate, type ImportedSongsDelta } from './libraryImportFlow';
import type { ImportCheckpoint } from './libraryImportCheckpoint';
import type { ImportFileProgress } from './libraryImportProgress';
import { createImportUiPublisher } from './libraryImportUiPublisher';

export const createImportProgressCallbacks = (options: {
  songs: Song[];
  signal: AbortSignal;
  parentSignal?: AbortSignal;
  activity: () => void;
  onApply: (update: ImportedSongsDelta) => Song[] | void | Promise<Song[] | void>;
  onPublish?: () => void;
  onFileProgress: (progress: ImportFileProgress) => void;
}) => {
  let confirmedSongs = options.songs;
  let closed = false;
  const isActive = (): boolean => !closed && !options.signal.aborted && !options.parentSignal?.aborted;
  const ui = createImportUiPublisher({ isActive, publishSongs: () => options.onPublish?.(), publishProgress: options.onFileProgress });
  return {
    isActive,
    close: (): void => { ui.flush(); closed = true; ui.cancel(); },
    getSongs: (): Song[] => confirmedSongs,
    onFileProgress: (progress: ImportFileProgress): void => {
      if (!isActive()) return;
      options.activity();
      ui.progress(progress);
    },
    onCheckpoint: async (checkpoint: ImportCheckpoint): Promise<void> => {
      if (!isActive()) return;
      const update: ImportedSongsDelta = { importedSongs: checkpoint.songs, baselineSongs: options.songs, activeTab: 'tracks' };
      const accepted = await options.onApply(update);
      // The state consumer owns the merge. Build a fallback snapshot only for
      // observers that do not return their accepted state.
      confirmedSongs = accepted ?? buildImportedSongsUpdate(confirmedSongs, checkpoint.songs).songs;
      options.activity();
      ui.accepted(checkpoint.songs.length);
    },
  };
};
