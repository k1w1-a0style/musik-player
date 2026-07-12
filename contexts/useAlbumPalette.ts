import { useEffect, useMemo, useRef, useState } from 'react';
import type { PaletteResult } from 'expo-system-audio';
import type { Song } from '../types/Song';
import {
  extractAlbumPalette,
  getAlbumPaletteArtworkUri,
} from './albumPaletteHelpers';
import { mergeNativeAndFallbackPalette } from '../utils/jsPaletteFallback';

/**
 * Native cover-palette hook.
 *
 * Transition semantics: when moving from one artwork URI to another, keep the
 * last resolved complete/effective palette visible while the replacement
 * palette loads, then switch directly to the new complete palette. If the
 * new extraction completes with null/failure, clear the retained palette so
 * consumers can use the deterministic JS fallback. When there is no artwork
 * URI, clear
 * immediately so a previous cover palette is not retained indefinitely.
 */
export const useAlbumPalette = (currentSong: Song | null): PaletteResult | null => {
  const [palette, setPalette] = useState<PaletteResult | null>(null);
  const currentArtworkUri = useMemo(() => getAlbumPaletteArtworkUri(currentSong), [currentSong]);
  const artworkSongRef = useRef<{ artworkUri: string | undefined; song: Song | null }>({
    artworkUri: currentArtworkUri,
    song: currentSong,
  });

  if (artworkSongRef.current.artworkUri !== currentArtworkUri) {
    artworkSongRef.current = { artworkUri: currentArtworkUri, song: currentSong };
  }

  useEffect(() => {
    if (!currentArtworkUri) {
      setPalette(null);
      return undefined;
    }

    const controller = new AbortController();

    extractAlbumPalette(currentArtworkUri, { signal: controller.signal }).then(nextPalette => {
      if (controller.signal.aborted) return;
      setPalette(
        nextPalette ? mergeNativeAndFallbackPalette(nextPalette, artworkSongRef.current.song) : null,
      );
    });

    return () => {
      controller.abort();
    };
  }, [currentArtworkUri]);

  return palette;
};
