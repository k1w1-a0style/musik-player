import { useEffect, useMemo, useState } from 'react';
import SystemAudio, { type PaletteResult } from 'expo-system-audio';
import type { Song } from '../types/Song';
import { getSongArtworkUri } from '../utils/songArtwork';

export const useAlbumPalette = (currentSong: Song | null): PaletteResult | null => {
  const [palette, setPalette] = useState<PaletteResult | null>(null);
  const currentArtworkUri = useMemo(() => getSongArtworkUri(currentSong), [currentSong]);

  useEffect(() => {
    let cancelled = false;

    if (!currentArtworkUri) {
      setPalette(null);
      return;
    }

    SystemAudio.extractPalette(currentArtworkUri)
      .then(nextPalette => {
        if (!cancelled) setPalette(nextPalette);
      })
      .catch(() => {
        if (!cancelled) setPalette(null);
      });

    return () => {
      cancelled = true;
    };
  }, [currentArtworkUri]);

  return palette;
};
