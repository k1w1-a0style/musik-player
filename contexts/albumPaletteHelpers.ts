import SystemAudio, { type PaletteResult } from 'expo-system-audio';
import type { Song } from '../types/Song';
import { getSongArtworkUri } from '../utils/songArtwork';
import { withTimeout } from '../utils/withTimeout';

export const ALBUM_PALETTE_EXTRACTION_TIMEOUT_MS = 3_000;

export const getAlbumPaletteArtworkUri = (song: Song | null): string | undefined =>
  getSongArtworkUri(song);

export const extractAlbumPalette = async (
  artworkUri: string | undefined,
): Promise<PaletteResult | null> => {
  if (!artworkUri) return null;

  try {
    return await withTimeout(
      SystemAudio.extractPalette(artworkUri),
      ALBUM_PALETTE_EXTRACTION_TIMEOUT_MS,
      'Album palette extraction timed out',
    );
  } catch {
    return null;
  }
};
