import type { Song } from '../types/Song';
import { displayAlbum, displayArtist, displayGenre } from './libraryPresentation';

const searchableSongText = (song: Song): string =>
  [song.title, displayArtist(song), displayAlbum(song), displayGenre(song)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

export const filterLibrarySongs = (songs: Song[], query: string): Song[] => {
  const q = query.trim().toLowerCase();
  if (!q) return songs;
  return songs.filter(song => searchableSongText(song).includes(q));
};

export const filterFavoriteSongs = (songs: Song[], favoriteIds: string[]): Song[] => {
  const favoriteSet = new Set(favoriteIds);
  return songs.filter(song => favoriteSet.has(song.id) || song.favorite);
};
