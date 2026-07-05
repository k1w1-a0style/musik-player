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
 * Reset semantics: whenever the artwork URI changes we clear the previous
 * native palette immediately, so consumers merging this with the JS fallback
 * never render with stale colors from the previous song while the new native
 * palette is still resolving. The `null` state means "no native palette yet";
 * the deterministic JS fallback then owns the visible accent until (or unless)
 * the new native palette lands.
 */
export const useAlbumPalette = (currentSong: Song | null): PaletteResult | null => {
  const [palette, setPalette] = useState<PaletteResult | null>(null);
  const currentArtworkUri = useMemo(() => getAlbumPaletteArtworkUri(currentSong), [currentSong]);

  useEffect(() => {
    // Clear synchronously on artwork change to avoid a visible frame where
    // the previous song's native palette is applied to the new cover.
    setPalette(null);

    if (!currentArtworkUri) return undefined;

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
