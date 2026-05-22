import type { Song } from '../types/Song';
import { parseId3FromUri, type Id3Tags } from './id3Parser';

export interface SongMetadataRefreshResult {
  songs: Song[];
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}
interface SongMetadataRefreshOptions {
  concurrency?: number;
}

const hasText = (value?: string): value is string => Boolean(value?.trim());

export const resolveMetadataRefreshUri = (song: Song): string | undefined => {
  const primaryUri = song.uri?.trim();
  if (primaryUri) return primaryUri;
  const fileInfoUri = song.fileInfo?.uri?.trim();
  return fileInfoUri || undefined;
};

const assignChanged = <K extends keyof Song>(patch: Partial<Song>, song: Song, key: K, value?: string): void => {
  if (!hasText(value)) return;
  const normalized = value.trim();
  if (song[key] !== normalized) patch[key] = normalized as Song[K];
};

export const applyId3TagsToSong = (song: Song, tags: Id3Tags): Song => {
  const patch: Partial<Song> = {};
  assignChanged(patch, song, 'title', tags.title);
  assignChanged(patch, song, 'artist', tags.artist);
  assignChanged(patch, song, 'album', tags.album);
  assignChanged(patch, song, 'year', tags.year);
  assignChanged(patch, song, 'genre', tags.genre);
  assignChanged(patch, song, 'trackNumber', tags.trackNumber);
  assignChanged(patch, song, 'discNumber', tags.discNumber);
  assignChanged(patch, song, 'comment', tags.comment);
  return Object.keys(patch).length > 0 ? { ...song, ...patch } : song;
};

const DEFAULT_CONCURRENCY = 4;
const MAX_CONCURRENCY = 6;
const didSongChange = (before: Song, after: Song): boolean => before !== after;

interface SongRefreshOutcome {
  song: Song;
  updatedDelta: number;
  skippedDelta: number;
  failedDelta: number;
  errorUri?: string;
}

const clampConcurrency = (value?: number): number => {
  if (!Number.isFinite(value)) return DEFAULT_CONCURRENCY;
  return Math.max(1, Math.min(MAX_CONCURRENCY, Math.floor(value as number)));
};

export const refreshSongsFromId3 = async (
  songs: Song[],
  options?: SongMetadataRefreshOptions,
): Promise<SongMetadataRefreshResult> => {
  const refreshed: Song[] = new Array(songs.length);
  const errors: string[] = [];
  const outcomes: SongRefreshOutcome[] = new Array(songs.length);
  const concurrency = clampConcurrency(options?.concurrency);
  let nextIndex = 0;

  const refreshOne = async (song: Song): Promise<SongRefreshOutcome> => {
    const uri = resolveMetadataRefreshUri(song);
    if (!uri) return { song, updatedDelta: 0, skippedDelta: 1, failedDelta: 0 };

    try {
      const tags = await parseId3FromUri(uri);
      const next = applyId3TagsToSong(song, tags);
      return {
        song: next,
        updatedDelta: didSongChange(song, next) ? 1 : 0,
        skippedDelta: 0,
        failedDelta: 0,
      };
    } catch {
      return { song, updatedDelta: 0, skippedDelta: 0, failedDelta: 1, errorUri: uri };
    }
  };

  const worker = async (): Promise<void> => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= songs.length) return;
      outcomes[index] = await refreshOne(songs[index]);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, songs.length || 1) }, () => worker()));

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  for (let index = 0; index < outcomes.length; index += 1) {
    const outcome = outcomes[index];
    refreshed[index] = outcome.song;
    updated += outcome.updatedDelta;
    skipped += outcome.skippedDelta;
    failed += outcome.failedDelta;
    if (outcome.errorUri) errors.push(outcome.errorUri);
  }

  return { songs: refreshed, updated, skipped, failed, errors };
};
