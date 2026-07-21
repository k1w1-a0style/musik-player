import { useEffect, useMemo, useRef, useState } from 'react';
import type { PaletteResult } from 'expo-system-audio';
import type { Song } from '../types/Song';
import {
  extractAlbumPalette,
  getAlbumPaletteArtworkUri,
} from './albumPaletteHelpers';
import { mergeNativeAndFallbackPalette } from '../utils/jsPaletteFallback';

interface ResolvedNativePalette {
  artworkUri: string;
  palette: PaletteResult;
}

/**
 * Native cover-palette hook.
 *
 * Transition semantics (source-keyed with graceful retention):
 * - the palette is always keyed to the current artwork URI;
 * - while a new extraction is in flight (track change with different artwork),
 *   the previously resolved palette is retained to prevent a flash of
 *   the JS-only fallback bleeding through during the async gap;
 * - once the native palette resolves for the current artwork, merge its
 *   optional fields with the JS fallback for the current song;
 * - when multiple songs share an artwork URI, reuse the raw native extraction
 *   but recompute fallback fields for the current song;
 * - clear immediately when no artwork exists, or after extraction returns null.
 */
export const useAlbumPalette = (currentSong: Song | null): PaletteResult | null => {
  const [resolvedNativePalette, setResolvedNativePalette] = useState<ResolvedNativePalette | null>(null);
  const currentArtworkUri = useMemo(() => getAlbumPaletteArtworkUri(currentSong), [currentSong]);
  const currentSongRef = useRef(currentSong);
  const lastEmittedPaletteRef = useRef<PaletteResult | null>(null);

  currentSongRef.current = currentSong;

  // Source-keyed: return the resolved palette when it belongs to the current artwork.
  // During loading (artwork changed but new palette not yet resolved), retain the
  // last emitted palette to avoid a flash of stale JS-only fallback.
  const visiblePalette = useMemo(() => {
    if (!currentArtworkUri) return null;

    if (resolvedNativePalette?.artworkUri === currentArtworkUri) {
      return mergeNativeAndFallbackPalette(resolvedNativePalette.palette, currentSong);
    }

    // Retain previous palette while loading the new artwork's palette.
    return lastEmittedPaletteRef.current;
  }, [currentArtworkUri, currentSong, resolvedNativePalette]);

  // Track the last non-null emitted palette for retention during transitions.
  useEffect(() => {
    if (visiblePalette !== null) {
      lastEmittedPaletteRef.current = visiblePalette;
    }
  }, [visiblePalette]);

  useEffect(() => {
    if (!currentArtworkUri) {
      setResolvedNativePalette(null);
      return undefined;
    }

    const controller = new AbortController();
    const requestedArtworkUri = currentArtworkUri;

    extractAlbumPalette(requestedArtworkUri, { signal: controller.signal }).then(nextPalette => {
      if (controller.signal.aborted) return;

      if (!nextPalette) {
        setResolvedNativePalette(null);
        return:  
      }

      setResolvedNativePalette({ artworkUri: requestedArtworkUri, palette: nextPalette });
    });

    return () => {
      controller.abort();
    };
  }, [currentArtworkUri]);

  return visiblePalette;
};
