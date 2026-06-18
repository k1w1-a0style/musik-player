import type { Song } from '../types/Song';
import { parseId3FromUri, type Id3Tags, type ParseId3Options } from './id3Parser';
import { throwIfAborted } from './withTimeout';

export interface SongMetadataRefreshResult {
  songs: Song[];
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
  patchesBySongId: Record<string, Partial<Song>>;
}
interface SongMetadataRefreshOptions extends Pick<ParseId3Options, 'includeCover' | 'maxHeadBytes' | 'maxTailBytes' | 'maxFrameScanBytes' | 'maxFrameOffsetBytes' | 'maxFrameBodyReadBytes'> {
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?: (processed: number, total: number) => void;
}

const hasText = (value?: string): value is string => Boolean(value?.trim());

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

interface NormalizedCoverReference {
  full: string;
  withoutQueryOrFragment: string;
  hasQueryOrFragment: boolean;
}

const normalizeCoverPath = (value: string): string =>
  safeDecode(value)
    .replace(/\\/g, '/')
    .replace(/\/+$/, '');

const normalizeCoverReference = (value?: string): NormalizedCoverReference | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const withoutQueryOrFragment = trimmed.split(/[?#]/)[0] ?? trimmed;
  const normalizedFull = normalizeCoverPath(trimmed);
  const normalizedPath = normalizeCoverPath(withoutQueryOrFragment);
  if (!normalizedFull || !normalizedPath) return undefined;
  return {
    full: normalizedFull,
    withoutQueryOrFragment: normalizedPath,
    hasQueryOrFragment: withoutQueryOrFragment.length !== trimmed.length,
  };
};

export const normalizeCoverReferenceForComparison = (value?: string): string | undefined =>
  normalizeCoverReference(value)?.withoutQueryOrFragment;

const areCoverReferencesEquivalent = (left?: string, right?: string): boolean => {
  const normalizedLeft = normalizeCoverReference(left);
  const normalizedRight = normalizeCoverReference(right);
  if (!normalizedLeft || !normalizedRight) return normalizedLeft === normalizedRight;
  if (normalizedLeft.full === normalizedRight.full) return true;
  return (
    normalizedLeft.withoutQueryOrFragment === normalizedRight.withoutQueryOrFragment
    && !(normalizedLeft.hasQueryOrFragment && normalizedRight.hasQueryOrFragment)
  );
};

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

export const buildId3SongPatch = (song: Song, tags: Id3Tags): Partial<Song> => {
  const patch: Partial<Song> = {};
  assignChanged(patch, song, 'title', tags.title);
  assignChanged(patch, song, 'artist', tags.artist);
  assignChanged(patch, song, 'album', tags.album);
  assignChanged(patch, song, 'year', tags.year);
  assignChanged(patch, song, 'genre', tags.genre);
  assignChanged(patch, song, 'trackNumber', tags.trackNumber);
  assignChanged(patch, song, 'discNumber', tags.discNumber);
  assignChanged(patch, song, 'comment', tags.comment);

  if (hasText(tags.cover)) {
    const normalizedCover = tags.cover.trim();
    if (
      !areCoverReferencesEquivalent(song.cover, normalizedCover)
      || !areCoverReferencesEquivalent(song.coverInfo?.uri, normalizedCover)
      || song.coverInfo?.status !== 'embedded'
    ) {
      patch.cover = normalizedCover;
      patch.coverInfo = {
        ...song.coverInfo,
        status: 'embedded',
        uri: normalizedCover,
        embeddedArtworkChecked: true,
      };
    }
  }

  return patch;
};

export const applyId3TagsToSong = (song: Song, tags: Id3Tags): Song => {
  const patch = buildId3SongPatch(song, tags);
  return Object.keys(patch).length > 0 ? { ...song, ...patch } : song;
};

const DEFAULT_CONCURRENCY = 1;
const MAX_CONCURRENCY = 2;
export const MANUAL_METADATA_REFRESH_ID3_OPTIONS = {
  includeCover: false,
  maxHeadBytes: 256 * 1024,
  maxTailBytes: 0,
  maxFrameOffsetBytes: 8 * 1024 * 1024,
  maxFrameBodyReadBytes: 512 * 1024,
} as const;
const REFRESH_YIELD_BATCH_SIZE = 1;
const yieldToEventLoop = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));
const didSongChange = (before: Song, after: Song): boolean => before !== after;

interface SongRefreshOutcome {
  song: Song;
  patch?: Partial<Song>;
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
  const patchesBySongId: Record<string, Partial<Song>> = {};
  const outcomes: SongRefreshOutcome[] = new Array(songs.length);
  const concurrency = clampConcurrency(options?.concurrency);
  const signal = options?.signal;
  throwIfAborted(signal);
  let nextIndex = 0;
  let processedSinceYield = 0;
  let processed = 0;

  const maybeYield = async (): Promise<void> => {
    processedSinceYield += 1;
    if (processedSinceYield < REFRESH_YIELD_BATCH_SIZE) return;
    processedSinceYield = 0;
    await yieldToEventLoop();
    throwIfAborted(signal);
  };

  const refreshOne = async (song: Song): Promise<SongRefreshOutcome> => {
    throwIfAborted(signal);
    const uri = resolveMetadataRefreshUri(song);
    if (!uri) return { song, updatedDelta: 0, skippedDelta: 1, failedDelta: 0 };

    try {
      const tags = await parseId3FromUri(uri, {
        ...MANUAL_METADATA_REFRESH_ID3_OPTIONS,
        includeCover: options?.includeCover ?? MANUAL_METADATA_REFRESH_ID3_OPTIONS.includeCover,
        maxHeadBytes: options?.maxHeadBytes ?? MANUAL_METADATA_REFRESH_ID3_OPTIONS.maxHeadBytes,
        maxTailBytes: options?.maxTailBytes ?? MANUAL_METADATA_REFRESH_ID3_OPTIONS.maxTailBytes,
        maxFrameScanBytes: options?.maxFrameScanBytes,
        maxFrameOffsetBytes: options?.maxFrameOffsetBytes ?? MANUAL_METADATA_REFRESH_ID3_OPTIONS.maxFrameOffsetBytes,
        maxFrameBodyReadBytes: options?.maxFrameBodyReadBytes ?? MANUAL_METADATA_REFRESH_ID3_OPTIONS.maxFrameBodyReadBytes,
        signal,
      });
      throwIfAborted(signal);
      const patch = buildId3SongPatch(song, tags);
      const next = Object.keys(patch).length > 0 ? { ...song, ...patch } : song;
      return {
        song: next,
        patch: didSongChange(song, next) ? patch : undefined,
        updatedDelta: didSongChange(song, next) ? 1 : 0,
        skippedDelta: 0,
        failedDelta: 0,
      };
    } catch {
      throwIfAborted(signal);
      return { song, updatedDelta: 0, skippedDelta: 0, failedDelta: 1, errorUri: uri };
    }
  };

  const worker = async (): Promise<void> => {
    while (true) {
      throwIfAborted(signal);
      const index = nextIndex;
      nextIndex += 1;
      if (index >= songs.length) return;
      outcomes[index] = await refreshOne(songs[index]);
      processed += 1;
      options?.onProgress?.(processed, songs.length);
      await maybeYield();
      throwIfAborted(signal);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, songs.length || 1) }, () => worker()));
  throwIfAborted(signal);

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  for (let index = 0; index < outcomes.length; index += 1) {
    const outcome = outcomes[index];
    refreshed[index] = outcome.song;
    updated += outcome.updatedDelta;
    skipped += outcome.skippedDelta;
    failed += outcome.failedDelta;
    if (outcome.patch) patchesBySongId[outcome.song.id] = outcome.patch;
    if (outcome.errorUri) errors.push(outcome.errorUri);
  }

  return { songs: refreshed, updated, skipped, failed, errors, patchesBySongId };
};
