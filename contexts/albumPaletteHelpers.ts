import SystemAudio, { type PaletteResult } from 'expo-system-audio';
import type { Song } from '../types/Song';
import { getSongArtworkUri } from '../utils/songArtwork';
import { withTimeout } from '../utils/withTimeout';

export const ALBUM_PALETTE_EXTRACTION_TIMEOUT_MS = 3_000;
const ALBUM_PALETTE_REQUEST_TIMEOUT_MS = (ALBUM_PALETTE_EXTRACTION_TIMEOUT_MS * 2) + 500;
const MAX_MEMORY_PALETTES = 32;

interface PaletteRequest {
  artworkUri: string;
  generation: number;
  result: Promise<PaletteResult | null>;
  resolve: (palette: PaletteResult | null) => void;
}

interface ActivePaletteExtraction {
  request: PaletteRequest;
}

let schedulerGeneration = 0;
let activePaletteExtraction: ActivePaletteExtraction | null = null;
let queuedPaletteRequest: PaletteRequest | null = null;
const paletteMemoryCache = new Map<string, PaletteResult>();

export const getAlbumPaletteArtworkUri = (song: Song | null): string | undefined =>
  getSongArtworkUri(song);

const createPaletteRequest = (artworkUri: string): PaletteRequest => {
  let resolve: (palette: PaletteResult | null) => void = () => undefined;
  const result = new Promise<PaletteResult | null>(settle => {
    resolve = settle;
  });
  return { artworkUri, generation: schedulerGeneration, result, resolve };
};

const readMemoryPalette = (artworkUri: string): PaletteResult | null => {
  const cached = paletteMemoryCache.get(artworkUri);
  if (!cached) return null;
  paletteMemoryCache.delete(artworkUri);
  paletteMemoryCache.set(artworkUri, cached);
  return cached;
};

const rememberPalette = (artworkUri: string, palette: PaletteResult): void => {
  paletteMemoryCache.delete(artworkUri);
  paletteMemoryCache.set(artworkUri, palette);
  while (paletteMemoryCache.size > MAX_MEMORY_PALETTES) {
    const oldest = paletteMemoryCache.keys().next().value as string | undefined;
    if (!oldest) break;
    paletteMemoryCache.delete(oldest);
  }
};

const startPaletteExtraction = (request: PaletteRequest): void => {
  if (request.generation !== schedulerGeneration) {
    request.resolve(null);
    return;
  }

  let nativeResult: Promise<PaletteResult | null>;
  try {
    nativeResult = SystemAudio.extractPalette(request.artworkUri);
  } catch {
    nativeResult = Promise.resolve(null);
  }

  // The native provider is not reliably cancellable. Bound each scheduler
  // slot so a hung extraction cannot permanently starve the latest track, and
  // absorb any later raw rejection after the JS timeout has moved on.
  const boundedResult = withTimeout(
    Promise.resolve(nativeResult).catch(() => null),
    ALBUM_PALETTE_EXTRACTION_TIMEOUT_MS,
    'Album palette extraction timed out',
  ).catch(() => null);
  const extraction: ActivePaletteExtraction = { request };
  activePaletteExtraction = extraction;

  void boundedResult.then(palette => {
    if (request.generation !== schedulerGeneration) return;
    if (palette) rememberPalette(request.artworkUri, palette);
    request.resolve(palette);
    if (activePaletteExtraction !== extraction) return;

    activePaletteExtraction = null;
    const next = queuedPaletteRequest;
    queuedPaletteRequest = null;
    if (next) startPaletteExtraction(next);
  });
};

const acquirePaletteExtraction = (artworkUri: string): Promise<PaletteResult | null> => {
  const cached = readMemoryPalette(artworkUri);
  if (cached) {
    queuedPaletteRequest?.resolve(null);
    queuedPaletteRequest = null;
    return Promise.resolve(cached);
  }

  if (activePaletteExtraction?.request.artworkUri === artworkUri) {
    queuedPaletteRequest?.resolve(null);
    queuedPaletteRequest = null;
    return activePaletteExtraction.request.result;
  }
  if (queuedPaletteRequest?.artworkUri === artworkUri) return queuedPaletteRequest.result;

  const request = createPaletteRequest(artworkUri);
  if (!activePaletteExtraction) {
    startPaletteExtraction(request);
    return request.result;
  }

  // Retain only the newest different artwork. Superseded hooks already ignore
  // stale results, and this prevents rapid swipes from building a native queue.
  queuedPaletteRequest?.resolve(null);
  queuedPaletteRequest = request;
  return request.result;
};

/** Test-only reset for module-level scheduler and memory-cache state. */
export const resetAlbumPaletteSingleFlightForTests = (): void => {
  schedulerGeneration += 1;
  activePaletteExtraction?.request.resolve(null);
  queuedPaletteRequest?.resolve(null);
  activePaletteExtraction = null;
  queuedPaletteRequest = null;
  paletteMemoryCache.clear();
};

export const extractAlbumPalette = async (
  artworkUri: string | undefined,
  options?: { signal?: AbortSignal },
): Promise<PaletteResult | null> => {
  if (!artworkUri) return null;

  try {
    // Two bounded slots cover one active extraction plus the latest queued
    // artwork. The caller can still abort immediately when its song changes.
    return await withTimeout(
      acquirePaletteExtraction(artworkUri),
      ALBUM_PALETTE_REQUEST_TIMEOUT_MS,
      'Album palette request timed out',
      { signal: options?.signal },
    );
  } catch {
    return null;
  }
};
