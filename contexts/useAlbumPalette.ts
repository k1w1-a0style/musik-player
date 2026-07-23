import { useEffect, useMemo, useRef, useState } from 'react';
import type { PaletteResult } from 'expo-system-audio';
import type { Song } from '../types/Song';
import {
  extractAlbumPalette,
  getAlbumPaletteArtworkUri,
} from './albumPaletteHelpers';
import { mergeNativeAndFallbackPalette } from '../utils/jsPaletteFallback';

interface NativePaletteResolution {
  artworkUri: string;
  palette: PaletteResult | null;
  status: 'resolved' | 'unavailable';
}

export interface AlbumPaletteState {
  palette: PaletteResult | null;
  isLoading: boolean;
}

/**
 * Native cover-palette hook with an explicit loading lifecycle.
 *
 * Transition semantics (source-keyed, immediate reset):
 * - the palette is always keyed to the current artwork URI;
 * - when the artwork URI changes, the visible palette resets to null and
 *   `isLoading` becomes true immediately;
 * - once the native palette resolves for the current artwork, merge its
 *   optional fields with the JS fallback for the current song;
 * - when multiple songs share an artwork URI, reuse the raw native extraction
 *   but recompute fallback fields for the current song;
 * - no artwork, extraction failure, rejection or timeout resolve to
 *   `palette = null` with `isLoading = false`.
 */
export const useAlbumPaletteState = (currentSong: Song | null): AlbumPaletteState => {
  const [resolution, setResolution] = useState<NativePaletteResolution | null>(null);
  const currentArtworkUri = useMemo(() => getAlbumPaletteArtworkUri(currentSong), [currentSong]);
  const currentSongRef = useRef(currentSong);

  currentSongRef.current = currentSong;

  const state = useMemo<AlbumPaletteState>(() => {
    if (!currentArtworkUri) {
      return { palette: null, isLoading: false };
    }

    if (resolution?.artworkUri !== currentArtworkUri) {
      return { palette: null, isLoading: true };
    }

    if (resolution.status === 'unavailable' || !resolution.palette) {
      return { palette: null, isLoading: false };
    }

    return {
      palette: mergeNativeAndFallbackPalette(resolution.palette, currentSong),
      isLoading: false,
    };
  }, [currentArtworkUri, currentSong, resolution]);

  useEffect(() => {
    if (!currentArtworkUri) {
      setResolution(null);
      return undefined;
    }

    const controller = new AbortController();
    const requestedArtworkUri = currentArtworkUri;

    extractAlbumPalette(requestedArtworkUri, { signal: controller.signal }).then(nextPalette => {
      if (controller.signal.aborted) return;

      setResolution({
        artworkUri: requestedArtworkUri,
        palette: nextPalette,
        status: nextPalette ? 'resolved' : 'unavailable',
      });
    });

    return () => {
      controller.abort();
    };
  }, [currentArtworkUri]);

  return state;
};

export const useAlbumPalette = (currentSong: Song | null): PaletteResult | null =>
  useAlbumPaletteState(currentSong).palette;
