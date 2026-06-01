import type { Song } from '../types/Song';
import { formatImportedAt } from './trackInfoHelpers';

export const useTrackInfoDerivedState = (song?: Song) => ({
  importedAt: song ? formatImportedAt(song.fileInfo?.importedAt) : 'Nicht verfügbar',
});
