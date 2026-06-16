import SystemAudio from 'expo-system-audio';
import type { Song } from '../types/Song';
import { getSongArtworkUri } from './songArtwork';
import { throwIfAborted } from './withTimeout';

export interface SongCoverBackfillResult {
  songs: Song[];
  updated: number;
  attempted: number;
}

export interface SongCoverBackfillOptions {
  concurrency?: number;
  batchSize?: number;
  signal?: AbortSignal;
  shouldProcessSong?: (song: Song) => boolean;
  yieldToUi?: () => Promise<void>;
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
  if (getSongArtworkUri(song)) return false;
  const uri = song.uri?.trim() || song.fileInfo?.uri?.trim();
  return Boolean(uri && !isRemoteUri(uri));
};

const applyCoverResult = (song: Song, uri?: string): Song => ({
  ...song,
  ...(uri ? { cover: uri } : {}),
  coverInfo: {
    ...song.coverInfo,
    status: uri ? 'embedded' : 'none',
    uri: uri || song.coverInfo?.uri,
  },
});

export const backfillEmbeddedSongCovers = async (
  songs: Song[],
  options: SongCoverBackfillOptions = {},
): Promise<SongCoverBackfillResult> => {
  const concurrency = clampConcurrency(options.concurrency);
  const batchSize = Math.max(1, Math.floor(options.batchSize ?? DEFAULT_BATCH_SIZE));
  const yieldToUi = options.yieldToUi ?? defaultYieldToUi;
  const shouldProcessSong = options.shouldProcessSong ?? needsEmbeddedCoverBackfill;
  const signal = options.signal;
  const nextSongs = [...songs];
  const candidateIndexes = songs.map((song, index) => ({ song, index })).filter(({ song }) => shouldProcessSong(song));
  let nextCandidate = 0;
  let processedSinceYield = 0;
  let updated = 0;

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
        await maybeYield();
        continue;
      }
      let artworkUri: string | undefined;
      try {
        artworkUri = (await SystemAudio.extractEmbeddedArtwork(uri))?.uri;
        if (artworkUri && isRemoteUri(artworkUri)) artworkUri = undefined;
        throwIfAborted(signal);
      } catch {
        throwIfAborted(signal);
      }
      const patched = applyCoverResult(candidate.song, artworkUri);
      nextSongs[candidate.index] = patched;
      if (patched !== candidate.song && artworkUri) updated += 1;
      await maybeYield();
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, candidateIndexes.length || 1) }, () => worker()));
  throwIfAborted(signal);
  return { songs: nextSongs, updated, attempted: candidateIndexes.length };
};
