import { useEffect, useMemo, useState } from 'react';
import type { PaletteResult } from 'expo-system-audio';
import type { Song } from '../types/Song';
import {
  extractAlbumPalette,
  getAlbumPaletteArtworkUri,
  getCachedAlbumPalette,
} from './albumPaletteHelpers';
import { getSongPaletteIdentity } from './albumPaletteIdentity';
import { mergeNativeAndFallbackPalette } from '../utils/jsPaletteFallback';

interface NativePaletteResolution {
  key: string;
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
  const identity = getSongPaletteIdentity(currentSong);
  const paletteKey = identity.key;
  const revision = identity.revision === '||' ? '' : identity.revision;

  const state = useMemo<AlbumPaletteState>(() => {
    if (!currentArtworkUri) {
      return { palette: null, isLoading: false };
    }

    if (!resolution || resolution.key !== paletteKey) {
      const cached = getCachedAlbumPalette(currentArtworkUri, revision);
      if (cached) return { palette: mergeNativeAndFallbackPalette(cached, currentSong), isLoading: false };
      return { palette: null, isLoading: true };
    }

    if (resolution.status === 'unavailable' || !resolution.palette) {
      return { palette: null, isLoading: false };
    }

    return {
      palette: mergeNativeAndFallbackPalette(resolution.palette, currentSong),
      isLoading: false,
    };
  }, [currentArtworkUri, currentSong, paletteKey, resolution, revision]);

  useEffect(() => {
    if (!currentArtworkUri || !paletteKey) {
      setResolution(null);
      return undefined;
    }

    const controller = new AbortController();
    const requestedArtworkUri = currentArtworkUri;

    extractAlbumPalette(requestedArtworkUri, { signal: controller.signal, revision }).then(nextPalette => {
      if (controller.signal.aborted) return;

      setResolution({
        key: paletteKey,
        palette: nextPalette,
        status: nextPalette ? 'resolved' : 'unavailable',
      });
    });

    return () => {
      controller.abort();
    };
  }, [currentArtworkUri, paletteKey, revision]);

  return state;
};
