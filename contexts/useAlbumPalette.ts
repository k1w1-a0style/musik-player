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
    const controller = new AbortController();

    extractAlbumPalette(currentArtworkUri, { signal: controller.signal }).then(nextPalette => {
      if (!controller.signal.aborted) setPalette(nextPalette);
    });

    return () => {
      controller.abort();
    };
  }, [currentArtworkUri]);

  return palette;
};
