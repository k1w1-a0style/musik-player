import SystemAudio, { type PaletteResult } from 'expo-system-audio';
import type { Song } from '../types/Song';
import { getSongArtworkUri } from '../utils/songArtwork';
import { withTimeout } from '../utils/withTimeout';

export const ALBUM_PALETTE_EXTRACTION_TIMEOUT_MS = 3_000;

type ActivePaletteExtraction = {
  artworkUri: string;
  result: Promise<PaletteResult | null>;
};

let activePaletteExtraction: ActivePaletteExtraction | null = null;

export const getAlbumPaletteArtworkUri = (song: Song | null): string | undefined =>
  getSongArtworkUri(song);

const acquirePaletteExtraction = (artworkUri: string): Promise<PaletteResult | null> | null => {
  if (activePaletteExtraction) {
    return activePaletteExtraction.artworkUri === artworkUri
      ? activePaletteExtraction.result
      : null;
  }

  // Start immediately so existing hook timing stays unchanged. Normalize both
  // synchronous and asynchronous native failures so a detached settlement after
  // caller timeout/abort can never become an unhandled rejection.
  let nativeResult: Promise<PaletteResult | null>;
  try {
    nativeResult = SystemAudio.extractPalette(artworkUri);
  } catch {
    nativeResult = Promise.resolve(null);
  }
  const result = Promise.resolve(nativeResult).catch(() => null);
  const extraction: ActivePaletteExtraction = { artworkUri, result };
  activePaletteExtraction = extraction;
  void result.then(() => {
    if (activePaletteExtraction === extraction) activePaletteExtraction = null;
  });
  return result;
};

/** Test-only reset for module-level single-flight state. */
export const resetAlbumPaletteSingleFlightForTests = (): void => {
  activePaletteExtraction = null;
};

export const extractAlbumPalette = async (
  artworkUri: string | undefined,
  options?: { signal?: AbortSignal },
): Promise<PaletteResult | null> => {
  if (!artworkUri) return null;

  const extraction = acquirePaletteExtraction(artworkUri);
  if (!extraction) return null;

  try {
    // SystemAudio.extractPalette is non-cancellable on some providers. The JS
    // awaiter may time out or abort, but this single-flight slot remains owned
    // until the raw native promise really settles. Rapid artwork changes can
    // therefore never accumulate detached native palette operations.
    return await withTimeout(
      extraction,
      ALBUM_PALETTE_EXTRACTION_TIMEOUT_MS,
      'Album palette extraction timed out',
      { signal: options?.signal },
    );
  } catch {
    return null;
  }
};
