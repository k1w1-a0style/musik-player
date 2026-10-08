import type { Song } from '../types/Song';
import { displayAlbum, displayArtist, displayGenre, displayTitle } from './libraryPresentation';

/** Same normalization for indexed metadata, playlist names and typed queries. */
export const normalizeLibrarySearchText = (value: string): string => value.trim()
  .toLocaleLowerCase('de-DE').normalize('NFKD').replace(/\p{M}/gu, '')
  .replace(/ł/g, 'l').replace(/ß/g, 'ss').replace(/ø/g, 'o')
  .replace(/đ/g, 'd').replace(/æ/g, 'ae').replace(/œ/g, 'oe');

const searchableTextCache = new WeakMap<Song, string>();

export const searchableSongText = (song: Song): string => {
  const cached = searchableTextCache.get(song);
  if (cached !== undefined) return cached;
  const searchable = normalizeLibrarySearchText([displayTitle(song), song.title, displayArtist(song), displayAlbum(song), displayGenre(song)]
    .filter(Boolean)
    .join(' '));
  searchableTextCache.set(song, searchable);
  return searchable;
};
