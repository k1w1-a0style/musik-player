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
 * Transition semantics (source-keyed with immediate reset):
 * - the palette is always keyed to the current artwork URI;
 * - immediately resets to null on track change when artwork differs,
 *   preventing stale palette from the previous track bleeding through;
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

  currentSongRef.current = currentSong;

  // Source-keyed: only return a palette when it belongs to the current artwork.
  // Immediately resets (returns null) on track change — no stale retention.
  const visiblePalette = useMemo(() => {
    if (!currentArtworkUri) return null;

    if (resolvedNativePalette?.artworkUri === currentArtworkUri) {
      return mergeNativeAndFallbackPalette(resolvedNativePalette.palette, currentSong);
    }

    return null;
  }, [currentArtworkUri, currentSong, resolvedNativePalette]);

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
        return;
      }

      setResolvedNativePalette({ artworkUri: requestedArtworkUri, palette: nextPalette });
    });

    return () => {
      controller.abort();
    };
  }, [currentArtworkUri]);

  return visiblePalette;
};
