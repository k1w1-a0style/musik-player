import type { Song } from '../types/Song';

export const getSongArtworkUri = (song?: Pick<Song, 'cover' | 'coverInfo'> | null): string | undefined =>
  song?.coverInfo?.uri ?? song?.cover;
