import type { ImageSourcePropType } from 'react-native';
import type { Song } from '../types/Song';

export const KIWI_MUSIC_ARTWORK = require('../assets/icon.png') as number;

const normalizeArtworkUri = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed || undefined;
};

/** Display fallback only: keep embedded artwork metadata and cover backfill unchanged. */
export const getArtworkSource = (artworkUri?: string): ImageSourcePropType => {
  const uri = normalizeArtworkUri(artworkUri);
  return uri ? { uri } : KIWI_MUSIC_ARTWORK;
};

export const getSongArtworkUri = (song?: Pick<Song, 'cover' | 'coverInfo'> | null): string | undefined => {
  if (!song) return undefined;
  return normalizeArtworkUri(song.coverInfo?.uri) ?? normalizeArtworkUri(song.cover);
};
