import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
 * Transition semantics:
 * - while a different artwork palette is loading, keep the complete palette
 *   that was last visible for the previous artwork;
 * - once the replacement native palette resolves, merge its optional fields
 *   with the fallback for the song currently using that artwork;
 * - when multiple songs share an artwork URI, reuse the raw native extraction
 *   but recompute fallback fields for the current song;
 * - clear immediately when no artwork exists, or after extraction returns null.
 */
export const useAlbumPalette = (currentSong: Song | null): PaletteResult | null => {
  const [resolvedNativePalette, setResolvedNativePalette] = useState<ResolvedNativePalette | null>(null);
  const currentArtworkUri = useMemo(() => getAlbumPaletteArtworkUri(currentSong), [currentSong]);
  const currentSongRef = useRef(currentSong);
  const retainedEffectivePaletteRef = useRef<PaletteResult | null>(null);

  currentSongRef.current = currentSong;

  const visiblePalette = useMemo(() => {
    if (!currentArtworkUri) return null;

    if (resolvedNativePalette?.artworkUri === currentArtworkUri) {
      return mergeNativeAndFallbackPalette(resolvedNativePalette.palette, currentSong);
    }

    return retainedEffectivePaletteRef.current;
  }, [currentArtworkUri, currentSong, resolvedNativePalette]);

  useLayoutEffect(() => {
    if (!currentArtworkUri) {
      retainedEffectivePaletteRef.current = null;
      return;
    }

    if (resolvedNativePalette?.artworkUri === currentArtworkUri && visiblePalette) {
      retainedEffectivePaletteRef.current = visiblePalette;
    }
  }, [currentArtworkUri, resolvedNativePalette, visiblePalette]);

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
        retainedEffectivePaletteRef.current = null;
        setResolvedNativePalette(null);
        return;
      }

      retainedEffectivePaletteRef.current = mergeNativeAndFallbackPalette(
        nextPalette,
        currentSongRef.current,
      );
      setResolvedNativePalette({ artworkUri: requestedArtworkUri, palette: nextPalette });
    });

    return () => {
      controller.abort();
    };
  }, [currentArtworkUri]);

  return visiblePalette;
};
