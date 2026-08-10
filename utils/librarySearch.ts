import type { Song } from '../types/Song';
import { displayAlbum, displayArtist, displayGenre, displayTitle } from './libraryPresentation';

const searchableTextCache = new WeakMap<Song, string>();

export const searchableSongText = (song: Song): string => {
  const cached = searchableTextCache.get(song);
  if (cached !== undefined) return cached;
  const searchable = [displayTitle(song), song.title, displayArtist(song), displayAlbum(song), displayGenre(song)]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('de-DE');
  searchableTextCache.set(song, searchable);
  return searchable;
};
