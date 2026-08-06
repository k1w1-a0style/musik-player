import type { Song } from '../types/Song';
import type { SongMetadataRefreshResult } from '../utils/songMetadataRefresh';

export interface MetadataRefreshChunkItem {
  originalIndex: number;
  processingPosition: number;
}

const mergeChunkSongs = (
  currentSongs: Song[],
  chunkSongs: Song[],
  chunkItems: readonly MetadataRefreshChunkItem[],
): Song[] => {
  const mergedSongs = [...currentSongs];
  const assignableCount = Math.min(chunkSongs.length, chunkItems.length);
  for (let index = 0; index < assignableCount; index += 1) {
    mergedSongs[chunkItems[index].originalIndex] = chunkSongs[index];
  }
  return mergedSongs;
};

const mergeOptionalArrays = <T>(current?: T[], chunk?: T[]): T[] => [
  ...(current ?? []),
  ...(chunk ?? []),
];

const mergeOptionalTrue = (current?: boolean, chunk?: boolean): true | undefined =>
  current === true || chunk === true ? true : undefined;

const mergeProcessedIndexes = (
  currentIndexes: number[] | undefined,
  chunkIndexes: number[] | undefined,
  chunkItems: readonly MetadataRefreshChunkItem[],
): number[] => {
  const remappedChunkIndexes = (chunkIndexes ?? []).flatMap(index => {
    const processingPosition = chunkItems[index]?.processingPosition;
    return typeof processingPosition === 'number' ? [processingPosition] : [];
  });
  return Array.from(new Set([...(currentIndexes ?? []), ...remappedChunkIndexes]))
    .sort((left, right) => left - right);
};

export const mergeMetadataRefreshResult = (
  current: SongMetadataRefreshResult,
  chunkResult: SongMetadataRefreshResult,
  chunkItems: readonly MetadataRefreshChunkItem[],
): SongMetadataRefreshResult => ({
  songs: mergeChunkSongs(current.songs, chunkResult.songs, chunkItems),
  updated: current.updated + chunkResult.updated,
  skipped: current.skipped + chunkResult.skipped,
  failed: current.failed + chunkResult.failed,
  errors: mergeOptionalArrays(current.errors, chunkResult.errors),
  errorDetails: mergeOptionalArrays(current.errorDetails, chunkResult.errorDetails),
  patchesBySongId: {
    ...(current.patchesBySongId ?? {}),
    ...(chunkResult.patchesBySongId ?? {}),
  },
  processed: current.processed + (chunkResult.processed ?? chunkResult.songs.length),
  total: current.total,
  completed: false,
  timedOut: mergeOptionalTrue(current.timedOut, chunkResult.timedOut),
  aborted: mergeOptionalTrue(current.aborted, chunkResult.aborted),
  lastProcessedSongId: chunkResult.lastProcessedSongId ?? current.lastProcessedSongId,
  processedIndexes: mergeProcessedIndexes(
    current.processedIndexes,
    chunkResult.processedIndexes,
    chunkItems,
  ),
});
