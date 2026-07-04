import type { Song } from '../types/Song';
import { displayAlbum, displayArtist, displayGenre, displayTitle } from './libraryPresentation';

export const searchableSongText = (song: Song): string =>
  [displayTitle(song), song.title, displayArtist(song), displayAlbum(song), displayGenre(song)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
