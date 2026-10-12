import SystemAudio, { type PaletteResult } from 'expo-system-audio';
import type { Song } from '../types/Song';
import { getSongArtworkUri } from '../utils/songArtwork';
import { withTimeout } from '../utils/withTimeout';
import { capturePersistenceEpoch } from '../utils/persistenceMaintenance';
import { isMetadataRefreshActive } from '../utils/metadataRefreshActivity';
import { getAlbumPaletteKey, getPersistentPaletteKey } from './albumPaletteIdentity';
import { hydrateAlbumPaletteCache, readAlbumPaletteCache, rememberAlbumPaletteCache, resetAlbumPaletteCacheForTests } from './albumPaletteCache';

export const ALBUM_PALETTE_EXTRACTION_TIMEOUT_MS = 3_000;
const ALBUM_PALETTE_REQUEST_TIMEOUT_MS = (ALBUM_PALETTE_EXTRACTION_TIMEOUT_MS * 2) + 500;

interface PaletteRequest {
  artworkUri: string;
  key: string;
  epoch: number;
  generation: number;
  expiresAt: number;
  result: Promise<PaletteResult | null>;
  resolve: (palette: PaletteResult | null) => void;
}

interface ActivePaletteExtraction {
  request: PaletteRequest;
  timeout: ReturnType<typeof setTimeout>;
  expired: boolean;
}

let schedulerGeneration = 0;
let activePaletteExtraction: ActivePaletteExtraction | null = null;
let queuedPaletteRequest: PaletteRequest | null = null;

export const getAlbumPaletteArtworkUri = (song: Song | null): string | undefined =>
  getSongArtworkUri(song);

const createPaletteRequest = (artworkUri: string, key: string): PaletteRequest => {
  let resolve: (palette: PaletteResult | null) => void = () => undefined;
  const result = new Promise<PaletteResult | null>(settle => {
    resolve = settle;
  });
  return { artworkUri, key, epoch: capturePersistenceEpoch(), generation: schedulerGeneration,
    expiresAt: Date.now() + ALBUM_PALETTE_REQUEST_TIMEOUT_MS, result, resolve };
};

export const getCachedAlbumPalette = (artworkUri: string, revision = ''): PaletteResult | null =>
  readAlbumPaletteCache(getAlbumPaletteKey(artworkUri, revision));

/** Never displace a foreground request to warm an adjacent cover. */
export const warmAlbumPalette = async (artworkUri: string | undefined, options?: { revision?: string; signal?: AbortSignal }): Promise<void> => {
  if (!artworkUri || isMetadataRefreshActive() || options?.signal?.aborted || getCachedAlbumPalette(artworkUri, options?.revision)
    || activePaletteExtraction || queuedPaletteRequest) return;
  await extractAlbumPalette(artworkUri, { ...options, background: true });
};

const settleNativeExtraction = (extraction: ActivePaletteExtraction, palette: PaletteResult | null): void => {
  clearTimeout(extraction.timeout);
  const { request } = extraction;
  if (request.generation !== schedulerGeneration) return;
  const current = request.epoch === capturePersistenceEpoch() && !extraction.expired;
  if (palette && current) rememberAlbumPaletteCache(request.key, palette, getPersistentPaletteKey(request.artworkUri));
  request.resolve(current ? palette : null);
  if (activePaletteExtraction !== extraction) return;
  activePaletteExtraction = null;
  const next = queuedPaletteRequest;
  queuedPaletteRequest = null;
  if (next) startPaletteExtraction(next);
};
const startPaletteExtraction = (request: PaletteRequest): void => {
  if (request.generation !== schedulerGeneration || request.expiresAt <= Date.now()) {
    request.resolve(null);
    return;
  }

  let nativeResult: Promise<PaletteResult | null>;
  try {
    nativeResult = SystemAudio.extractPalette(request.artworkUri);
  } catch {
    nativeResult = Promise.resolve(null);
  }

  // The UI wait is bounded, but native ownership survives that timeout. A
  // hung provider must never create overlapping extractions on each swipe.
  const extraction: ActivePaletteExtraction = { request, expired: false,
    timeout: setTimeout(() => { extraction.expired = true; request.resolve(null); }, ALBUM_PALETTE_EXTRACTION_TIMEOUT_MS) };
  activePaletteExtraction = extraction;
  void Promise.resolve(nativeResult).then(palette => settleNativeExtraction(extraction, palette),
    () => settleNativeExtraction(extraction, null));
};

const acquirePaletteExtraction = (artworkUri: string, key: string): Promise<PaletteResult | null> => {
  const cached = readAlbumPaletteCache(key);
  if (cached) {
    queuedPaletteRequest?.resolve(null);
    queuedPaletteRequest = null;
    return Promise.resolve(cached);
  }

  if (activePaletteExtraction?.request.key === key && activePaletteExtraction.request.epoch === capturePersistenceEpoch()) {
    queuedPaletteRequest?.resolve(null);
    queuedPaletteRequest = null;
    return activePaletteExtraction.request.result;
  }
  if (queuedPaletteRequest?.key === key) return queuedPaletteRequest.result;

  const request = createPaletteRequest(artworkUri, key);
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
  clearTimeout(activePaletteExtraction?.timeout);
  queuedPaletteRequest?.resolve(null);
  activePaletteExtraction = null;
  queuedPaletteRequest = null;
  resetAlbumPaletteCacheForTests();
};

export const extractAlbumPalette = async (
  artworkUri: string | undefined,
  options?: { signal?: AbortSignal; revision?: string; background?: boolean },
): Promise<PaletteResult | null> => {
  if (!artworkUri || options?.signal?.aborted) return null;

  try {
    if (getPersistentPaletteKey(artworkUri)) {
      await withTimeout(hydrateAlbumPaletteCache(), 100, 'Palette cache startup read budget').catch(() => undefined);
      if (options?.signal?.aborted) return null;
    }
    if (options?.background && (isMetadataRefreshActive() || activePaletteExtraction || queuedPaletteRequest)) return null;
    // Two bounded slots cover one active extraction plus the latest queued
    // artwork. The caller can still abort immediately when its song changes.
    return await withTimeout(
      acquirePaletteExtraction(artworkUri, getAlbumPaletteKey(artworkUri, options?.revision)),
      ALBUM_PALETTE_REQUEST_TIMEOUT_MS,
      'Album palette request timed out',
      { signal: options?.signal },
    );
  } catch {
    return null;
  }
};
