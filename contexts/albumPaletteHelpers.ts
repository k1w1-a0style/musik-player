import SystemAudio, { type PaletteResult } from 'expo-system-audio';
import type { Song } from '../types/Song';
import { getSongArtworkUri } from '../utils/songArtwork';

export const getAlbumPaletteArtworkUri = (song: Song | null): string | undefined =>
  getSongArtworkUri(song);

export const extractAlbumPalette = async (
  artworkUri: string | undefined,
): Promise<PaletteResult | null> => {
  if (!artworkUri) return null;

  try {
    return await SystemAudio.extractPalette(artworkUri);
  } catch {
    return null;
  }
};
