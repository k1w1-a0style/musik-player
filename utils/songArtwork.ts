import type { Song } from '../types/Song';

const normalizeArtworkUri = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed || undefined;
};

export const getSongArtworkUri = (song?: Pick<Song, 'cover' | 'coverInfo'> | null): string | undefined => {
  if (!song) return undefined;
  return normalizeArtworkUri(song.coverInfo?.uri) ?? normalizeArtworkUri(song.cover);
};