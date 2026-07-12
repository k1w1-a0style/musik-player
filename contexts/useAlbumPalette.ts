import { useEffect, useMemo, useState } from 'react';
import type { PaletteResult } from 'expo-system-audio';
import type { Song } from '../types/Song';
import {
  extractAlbumPalette,
  getAlbumPaletteArtworkUri,
} from './albumPaletteHelpers';

/**
 * Native cover-palette hook.
 *
 * Transition semantics: when moving from one artwork URI to another, keep the
 * last resolved native palette visible while the replacement palette loads,
 * then switch directly to the new native palette. If the new extraction
 * completes with null/failure, clear the retained palette so consumers can use
 * the deterministic JS fallback. When there is no artwork URI, clear
 * immediately so a previous cover palette is not retained indefinitely.
 */
export const useAlbumPalette = (currentSong: Song | null): PaletteResult | null => {
  const [palette, setPalette] = useState<PaletteResult | null>(null);
  const currentArtworkUri = useMemo(() => getAlbumPaletteArtworkUri(currentSong), [currentSong]);

  useEffect(() => {
    if (!currentArtworkUri) {
      setPalette(null);
      return undefined;
    }

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
