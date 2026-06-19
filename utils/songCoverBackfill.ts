import SystemAudio from 'expo-system-audio';
import type { Song } from '../types/Song';
import { cacheLocalCoverFile, isLikelyVolatileArtworkUri } from './coverCache';
import type { CoverCacheProtection } from './coverCacheCleanup';
import { getSongArtworkUri } from './songArtwork';
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
  shouldProcessSong?: (song: Song) => boolean;
  yieldToUi?: () => Promise<void>;
  coverCacheProtection?: CoverCacheProtection;
}

const DEFAULT_CONCURRENCY = 1;
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
      let artworkUri: string | undefined;
      let hadLocalArtwork = false;
      try {
        const extractedUri = (await SystemAudio.extractEmbeddedArtwork(uri))?.uri;
        hadLocalArtwork = Boolean(extractedUri && !isRemoteUri(extractedUri));
        if (hadLocalArtwork) artworkUri = await cacheLocalCoverFile(candidate.song.id, extractedUri, coverCacheProtection);
        throwIfAborted(signal);
      } catch {
        throwIfAborted(signal);
        attempted += 1;
        await maybeYield();
        continue;
      }
      if (hadLocalArtwork && !artworkUri) {
        attempted += 1;
        await maybeYield();
        continue;
      }
      const patched = applyCoverResult(candidate.song, artworkUri);
      nextSongs[candidate.index] = patched;
      if (patched !== candidate.song && artworkUri) updated += 1;
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
