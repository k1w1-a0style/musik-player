import type { Song } from '../types/Song';
import { isDemoSong } from './libraryDemoSongs';
import { buildSongKey, displayAlbum, displayArtist, displayTitle, normalizeLibraryText } from './libraryPresentation';

// Includes the individual card's bottom gap; keep FlatList offsets accurate.
export const SONG_ROW_GAP = 6;
export const getSongCardHeight = (fontScale = 1, banner = false): number => {
  const scale = Number.isFinite(fontScale) ? Math.max(1, fontScale) : 1;
  // Explicit title/artist/metadata line heights plus margins and vertical padding.
  return Math.max(banner ? 88 : 70, Math.ceil((banner ? 55 : 51) * scale + 18));
};
export const SONG_ROW_HEIGHT = getSongCardHeight() + SONG_ROW_GAP;

export const getLibrarySongItemLayout = (
  _: ArrayLike<Song> | null | undefined,
  index: number,
  fontScale = 1,
): { length: number; offset: number; index: number } => ({
  length: getSongCardHeight(fontScale) + SONG_ROW_GAP,
  offset: (getSongCardHeight(fontScale) + SONG_ROW_GAP) * index,
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
