import { useCallback } from 'react';
import type { Song } from '../types/Song';
import type { SongLibraryState } from './songLibraryState';

export const useConfirmedSongMetadata = (
  library: SongLibraryState | undefined,
  updateSongMetadata: (songId: string, patch: Partial<Song>) => void,
): ((songId: string, patch: Partial<Song>) => Promise<void>) =>
  useCallback(async (songId, patch) => {
    if (!library) throw new Error('Bibliothek ist noch nicht bereit. Bitte erneut versuchen.');
    if (!library.getCurrent().some(song => song.id === songId))
      throw new Error('Der Titel ist nicht mehr in der Bibliothek. Bitte die Vorschau neu laden.');
    updateSongMetadata(songId, patch);
    await library.confirmCurrent();
  }, [library, updateSongMetadata]);
