import { useEffect, useMemo, useState } from 'react';
import type { PaletteResult } from 'expo-system-audio';
import type { Song } from '../types/Song';
import {
  extractAlbumPalette,
  getAlbumPaletteArtworkUri,
} from './albumPaletteHelpers';

export const useAlbumPalette = (currentSong: Song | null): PaletteResult | null => {
  const [palette, setPalette] = useState<PaletteResult | null>(null);
  const currentArtworkUri = useMemo(() => getAlbumPaletteArtworkUri(currentSong), [currentSong]);

  useEffect(() => {
    let cancelled = false;

    extractAlbumPalette(currentArtworkUri).then(nextPalette => {
      if (!cancelled) setPalette(nextPalette);
    });

    return () => {
      cancelled = true;
    };
  }, [currentArtworkUri]);

  return palette;
};
