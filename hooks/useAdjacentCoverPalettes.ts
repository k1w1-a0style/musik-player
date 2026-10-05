import { useEffect } from 'react';
import type { Song } from '../types/Song';
import { getSongArtworkUri } from '../utils/songArtwork';
import { warmAlbumPalette } from '../contexts/albumPaletteHelpers';

export const useAdjacentCoverPalettes = (next: Song | null, previous: Song | null,
  paletteLoading: boolean | undefined) => {
  const nextUri = getSongArtworkUri(next);
  const previousUri = getSongArtworkUri(previous);
  useEffect(() => {
    if (paletteLoading) return;
    let cancelled = false;
    const timer = setTimeout(() => { void (async () => {
      await warmAlbumPalette(nextUri);
      if (!cancelled) await warmAlbumPalette(previousUri);
    })(); }, 100);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [nextUri, paletteLoading, previousUri]);
};
