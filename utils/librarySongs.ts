import type { Song } from '../types/Song';
import { searchableSongText } from './librarySearch';

export const filterLibrarySongs = (songs: Song[], query: string): Song[] => {
  const q = query.trim().toLowerCase();
  if (!q) return songs;
  return songs.filter(song => searchableSongText(song).includes(q));
};

export const filterFavoriteSongs = (songs: Song[], favoriteIds: string[]): Song[] => {
  const favoriteSet = new Set(favoriteIds);
  return songs.filter(song => favoriteSet.has(song.id));
};
