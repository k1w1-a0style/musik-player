import SystemAudio from 'expo-system-audio';
import type { Song } from '../types/Song';
import { cacheLocalCoverFile, isLikelyVolatileArtworkUri } from './coverCache';
import type { CoverCacheProtection } from './coverCacheCleanup';
import { getSongArtworkUri } from './songArtwork';
import { runNativeReadWithTimeout } from './nativeReadTimeout';
import { isAbortError, throwIfAborted } from './withTimeout';

export interface SongCoverBackfillResult {
  songs: Song[];
  updated: number;
  attempted: number;
  aborted?: boolean;
}

export interface SongCoverBackfillOptions {
  concurrency?: number;
  batchSize?: number;
  signal?: AbortSignal;
  nativeReadTimeoutMs?: number;
  shouldProcessSong?: (song: Song) => boolean;
  yieldToUi?: () => Promise<void>;
  coverCacheProtection?: CoverCacheProtection;
  onSongProcessed?: (song: Song, index: number) => void;
}

const DEFAULT_CONCURRENCY = 2;
const MAX_CONCURRENCY = 2;
const DEFAULT_BATCH_SIZE = 8;

const clampConcurrency = (value?: number): number => {
  if (!Number.isFinite(value)) return DEFAULT_CONCURRENCY;
  return Math.max(1, Math.min(MAX_CONCURRENCY, Math.floor(value as number)));
};

const defaultYieldToUi = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

const isRemoteUri = (uri: string): boolean => /^https?:\/\//i.test(uri.trim());

export const needsEmbeddedCoverBackfill = (song: Song): boolean => {
  const uri = song.uri?.trim() || song.fileInfo?.uri?.trim();
  if (!uri || isRemoteUri(uri)) return false;

  if (song.coverInfo?.pendingEmbeddedArtworkRefresh === true) return true;

  const artworkUri = getSongArtworkUri(song);
  if (song.coverInfo?.embeddedArtworkRefreshFailed === true && artworkUri) return false;
  if (artworkUri && !isLikelyVolatileArtworkUri(artworkUri)) return false;
  if (song.coverInfo?.status === 'none' && song.coverInfo.embeddedArtworkChecked === true && !song.coverInfo.uri) return false;
  return true;
};

const applyCoverResult = (song: Song, uri?: string): Song => {
  const pendingPreviewUri = song.coverInfo?.pendingEmbeddedArtworkRefresh === true
    ? getSongArtworkUri(song)
    : undefined;
  const nextUri = uri ?? pendingPreviewUri;

  return {
    ...song,
    cover: nextUri,
    coverInfo: {
      ...song.coverInfo,
      status: uri ? 'cached' : pendingPreviewUri ? 'external' : 'none',
      uri: nextUri,
      embeddedArtworkChecked: true,
      ...(song.coverInfo?.pendingEmbeddedArtworkRefresh === true ? {
        pendingEmbeddedArtworkRefresh: false,
        embeddedArtworkRefreshFailed: !uri && Boolean(pendingPreviewUri),
      } : {}),
    },
  };
};

type EmbeddedCoverReadResult =
  | { kind: 'success'; artworkUri?: string }
  | { kind: 'failure' }
  | { kind: 'timeout' };

const readAndCacheEmbeddedCover = async (
  song: Song,
  uri: string,
  options: SongCoverBackfillOptions,
): Promise<EmbeddedCoverReadResult> => {
  const nativeRead = await runNativeReadWithTimeout(
    () => SystemAudio.extractEmbeddedArtwork(uri),
    { timeoutMs: options.nativeReadTimeoutMs, signal: options.signal, label: 'Embedded artwork extraction' },
  );
  if (nativeRead.kind !== 'success') return nativeRead;
  const extractedUri = nativeRead.value?.uri;
  if (!extractedUri || isRemoteUri(extractedUri)) return { kind: 'success' };
  try {
    const artworkUri = await cacheLocalCoverFile(song.id, extractedUri, options.coverCacheProtection);
    throwIfAborted(options.signal);
    return artworkUri ? { kind: 'success', artworkUri } : { kind: 'failure' };
  } catch {
    throwIfAborted(options.signal);
    return { kind: 'failure' };
  }
};

export const backfillEmbeddedSongCovers = async (
  songs: Song[],
  options: SongCoverBackfillOptions = {},
): Promise<SongCoverBackfillResult> => {
  const concurrency = clampConcurrency(options.concurrency);
  const batchSize = Math.max(1, Math.floor(options.batchSize ?? DEFAULT_BATCH_SIZE));
  const yieldToUi = options.yieldToUi ?? defaultYieldToUi;
  const shouldProcessSong = options.shouldProcessSong ?? needsEmbeddedCoverBackfill;
  const signal = options.signal;
  const coverCacheProtection = options.coverCacheProtection;
  const nextSongs = [...songs];
  const candidateIndexes = songs.map((song, index) => ({ song, index })).filter(({ song }) => shouldProcessSong(song));
  let nextCandidate = 0;
  let processedSinceYield = 0;
  let updated = 0;
  let attempted = 0;

  const maybeYield = async (): Promise<void> => {
    processedSinceYield += 1;
    if (processedSinceYield < batchSize) return;
    processedSinceYield = 0;
    await yieldToUi();
    throwIfAborted(signal);
  };

  const worker = async (): Promise<void> => {
    while (true) {
      throwIfAborted(signal);
      const candidate = candidateIndexes[nextCandidate];
      nextCandidate += 1;
      if (!candidate) return;
      const uri = candidate.song.uri?.trim() || candidate.song.fileInfo?.uri?.trim();
      if (!uri) {
        attempted += 1;
        await maybeYield();
        continue;
      }
      const coverRead = await readAndCacheEmbeddedCover(candidate.song, uri, {
        ...options,
        signal,
        coverCacheProtection,
      });
      if (coverRead.kind !== 'success') {
        attempted += 1;
        await maybeYield();
        // The timed-out native call may still be running. Retire this worker so
        // detached calls can never exceed the configured concurrency.
        if (coverRead.kind === 'timeout') return;
        continue;
      }
      const patched = applyCoverResult(candidate.song, coverRead.artworkUri);
      nextSongs[candidate.index] = patched;
      options.onSongProcessed?.(patched, candidate.index);
      if (patched !== candidate.song && coverRead.artworkUri) updated += 1;
      attempted += 1;
      await maybeYield();
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.min(concurrency, candidateIndexes.length || 1) }, () => worker()));
    throwIfAborted(signal);
  } catch (error) {
    if (isAbortError(error) && attempted > 0) return { songs: nextSongs, updated, attempted, aborted: true };
    throw error;
  }
  return { songs: nextSongs, updated, attempted };
};
