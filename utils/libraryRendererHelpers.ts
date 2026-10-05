import type { Song } from '../types/Song';
import { isDemoSong } from './libraryDemoSongs';
import { buildSongKey, displayAlbum, displayArtist, displayTitle, normalizeLibraryText } from './libraryPresentation';

// Includes the individual card's bottom gap; keep FlatList offsets accurate.
export const SONG_ROW_HEIGHT = 88;

export const getLibrarySongItemLayout = (
  _: ArrayLike<Song> | null | undefined,
  index: number,
): { length: number; offset: number; index: number } => ({
  length: SONG_ROW_HEIGHT,
  offset: SONG_ROW_HEIGHT * index,
  index,
});

export const buildSongCardSong = (song: Song): Song => ({
  ...song,
  id: normalizeLibraryText(song.id),
  title: displayTitle(song),
  artist: displayArtist(song),
  album: displayAlbum(song),
});

export const getLibrarySongKey = (song: Song): string => normalizeLibraryText(song.id) || buildSongKey(song);

export const shouldShowTrackInfoAction = (song: Song): boolean => !isDemoSong(song);
