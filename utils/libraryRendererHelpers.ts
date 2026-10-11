import type { Song } from '../types/Song';
import { isDemoSong } from './libraryDemoSongs';
import { buildSongKey, displayAlbum, displayArtist, displayTitle, normalizeLibraryText } from './libraryPresentation';
import type { LibraryDensity } from './playerPresentation';

// Includes the individual card's bottom gap; keep FlatList offsets accurate.
export const SONG_ROW_GAP = 6;
export const getSongCardHeight = (fontScale = 1, banner = false, density: LibraryDensity = 'standard'): number => {
  const scale = Number.isFinite(fontScale) ? Math.max(1, fontScale) : 1;
  // Explicit title/artist/metadata line heights plus margins and vertical padding.
  const padding = density === 'compact' ? 12 : 18;
  return Math.max(banner ? 88 : density === 'compact' ? 64 : 70, Math.ceil((banner ? 55 : 51) * scale + padding));
};

export const getLibraryGroupRowHeight = (fontScale = 1, density: LibraryDensity = 'standard'): number => {
  const scale = Number.isFinite(fontScale) ? Math.max(1, fontScale) : 1;
  return Math.max(density === 'compact' ? 60 : 66, Math.ceil(36 * scale + (density === 'compact' ? 10 : 14)));
};

export const getLibrarySongItemLayout = (
  _: ArrayLike<Song> | null | undefined,
  index: number,
  fontScale = 1,
  density: LibraryDensity = 'standard',
): { length: number; offset: number; index: number } => ({
  length: getSongCardHeight(fontScale, false, density) + SONG_ROW_GAP,
  offset: (getSongCardHeight(fontScale, false, density) + SONG_ROW_GAP) * index,
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
