import { useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Song } from '../types/Song';
import { getMetadataRefreshFlowCopy } from '../utils/libraryImportFlow';
import { metadataRefreshProgressStatus } from '../utils/libraryImportMessages';
import { isTimeoutError } from '../utils/withTimeout';
import { isMetadataRefreshPartialError } from '../utils/songMetadataRefresh';
import type { refreshSongsFromId3, SongMetadataRefreshProcessedSong, SongMetadataRefreshResult } from '../utils/songMetadataRefresh';
import {
  beginMetadataRefreshOperation,
  getMetadataRefreshOperationState,
  updateMetadataRefreshProgress,
} from '../utils/metadataRefreshOperation';
import type { MetadataRefreshGeneration, MetadataRefreshSongsResult, TimeoutRunner } from './libraryMetadataRefreshActionTypes';


const METADATA_REFRESH_CHUNK_SIZE = 25;
const METADATA_REFRESH_ID3_CONCURRENCY = 2;
const yieldToEventLoop = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

interface MetadataRefreshProcessingItem {
  song: Song;
  originalIndex: number;
  processingPosition: number;
}

const emptyMetadataRefreshResult = (songs: Song[], total = songs.length): SongMetadataRefreshResult => ({
  songs,
  updated: 0,
  skipped: 0,
  failed: 0,
  errors: [],
  errorDetails: [],
  patchesBySongId: {},
  processed: 0,
  total,
  completed: false,
  processedIndexes: [],
});

const mergeMetadataRefreshResult = (
  current: SongMetadataRefreshResult,
  chunkResult: SongMetadataRefreshResult,
  chunkItems: MetadataRefreshProcessingItem[],
): SongMetadataRefreshResult => {
  const mergedSongs = [...current.songs];
  for (let index = 0; index < chunkResult.songs.length && index < chunkItems.length; index += 1) {
    mergedSongs[chunkItems[index].originalIndex] = chunkResult.songs[index];
  }
  return {
    songs: mergedSongs,
    updated: current.updated + chunkResult.updated,
    skipped: current.skipped + chunkResult.skipped,
    failed: current.failed + chunkResult.failed,
    errors: [...(current.errors ?? []), ...(chunkResult.errors ?? [])],
    errorDetails: [...(current.errorDetails ?? []), ...(chunkResult.errorDetails ?? [])],
    patchesBySongId: { ...(current.patchesBySongId ?? {}), ...(chunkResult.patchesBySongId ?? {}) },
    processed: current.processed + (chunkResult.processed ?? chunkResult.songs.length),
    total: current.total,
    completed: false,
    timedOut: chunkResult.timedOut || current.timedOut || undefined,
    aborted: chunkResult.aborted || current.aborted || undefined,
    lastProcessedSongId: chunkResult.lastProcessedSongId ?? current.lastProcessedSongId,
    processedIndexes: Array.from(new Set([
      ...(current.processedIndexes ?? []),
      ...((chunkResult.processedIndexes ?? []).map(index => chunkItems[index]?.processingPosition).filter((index): index is number => typeof index === 'number')),
    ])).sort((a, b) => a - b),
  };
};

const mergeProcessedSongIntoRefreshResult = (
  current: SongMetadataRefreshResult,
  processedSong: SongMetadataRefreshProcessedSong,
): SongMetadataRefreshResult => {
  const songs = [...current.songs];
  songs[processedSong.index] = processedSong.song;
  return {
    songs,
    updated: current.updated + processedSong.updatedDelta,
    skipped: current.skipped + processedSong.skippedDelta,
    failed: current.failed + processedSong.failedDelta,
    errors: processedSong.errorUri ? [...current.errors, processedSong.errorUri] : current.errors,
    errorDetails: processedSong.errorUri
      ? [...(current.errorDetails ?? []), { uri: processedSong.errorUri, reason: processedSong.errorReason ?? 'unbekannt' }]
      : current.errorDetails,
    patchesBySongId: processedSong.patch
      ? { ...current.patchesBySongId, [processedSong.song.id]: processedSong.patch }
      : current.patchesBySongId,
    processed: current.processed + 1,
    total: current.total,
    completed: false,
    timedOut: current.timedOut,
    aborted: current.aborted,
    lastProcessedSongId: processedSong.song.id,
    processedIndexes: Array.from(new Set([...(current.processedIndexes ?? []), processedSong.index])).sort((a, b) => a - b),
  };
};

const buildMetadataRefreshProcessingItems = (songs: Song[], startIndex: number): MetadataRefreshProcessingItem[] => [
  ...songs.slice(startIndex).map((song, offset) => ({ song, originalIndex: startIndex + offset, processingPosition: offset })),
  ...songs.slice(0, startIndex).map((song, originalIndex) => ({ song, originalIndex, processingPosition: songs.length - startIndex + originalIndex })),
];

const advanceResumeIndex = (startIndex: number, processed: number, total: number): number =>
  total > 0 ? (startIndex + processed) % total : 0;

const didCompleteRefreshCycle = (startIndex: number, processed: number, total: number): boolean =>
  total <= 0 || (processed > 0 && advanceResumeIndex(startIndex, processed, total) === 0);

const countContiguousProcessed = (processedIndexes: number[] | undefined): number => {
  const processed = new Set(processedIndexes ?? []);
  let contiguous = 0;
  while (processed.has(contiguous)) contiguous += 1;
  return contiguous;
};

const completeOrResumePartialResult = (
  result: SongMetadataRefreshResult,
  startIndex: number,
  total: number,
): MetadataRefreshSongsResult => {
  const contiguousProcessed = countContiguousProcessed(result.processedIndexes);
  const nextResumeIndex = advanceResumeIndex(startIndex, contiguousProcessed, total);
  if (didCompleteRefreshCycle(startIndex, contiguousProcessed, total)) {
    return { ...result, completed: true, timedOut: undefined, nextResumeIndex: 0 };
  }

  return { ...result, completed: false, timedOut: true, nextResumeIndex };
};

interface UseLibraryMetadataRefreshRunnerOptions {
  songs: Song[];
  setImportStatus: Dispatch<SetStateAction<string | null>>;
  importTimeoutMs: number;
  refreshSongsFromId3Impl: typeof refreshSongsFromId3;
  withTimeoutImpl: TimeoutRunner;
  ensureCurrentRefresh: (generation: MetadataRefreshGeneration) => void;
}

export const useLibraryMetadataRefreshRunner = ({
  songs,
  setImportStatus,
  importTimeoutMs,
  refreshSongsFromId3Impl,
  withTimeoutImpl,
  ensureCurrentRefresh,
}: UseLibraryMetadataRefreshRunnerOptions) => {
  const resumeIndexRef = useRef(0);

  const runMetadataRefresh = useCallback(async (generation: MetadataRefreshGeneration): Promise<MetadataRefreshSongsResult> => {
    const refreshCopy = getMetadataRefreshFlowCopy();
    const startedAt = Date.now();
    // Source of truth for resumeIndex is the operation store; the local ref stays
    // in sync so existing tests that only seed the ref keep working.
    const storedResume = getMetadataRefreshOperationState().resumeIndex;
    if (storedResume > 0 && resumeIndexRef.current === 0) {
      resumeIndexRef.current = storedResume;
    }
    const startIndex = resumeIndexRef.current < songs.length ? resumeIndexRef.current : 0;
    beginMetadataRefreshOperation(songs.length, startIndex);
    const processingItems = buildMetadataRefreshProcessingItems(songs, startIndex);
    let result = emptyMetadataRefreshResult(songs, songs.length);
    setImportStatus(startIndex > 0 ? `${refreshCopy.readingStatus} (Fortsetzen bei ${startIndex + 1}/${songs.length})` : refreshCopy.readingStatus);

    for (let chunkStart = 0; chunkStart < processingItems.length; chunkStart += METADATA_REFRESH_CHUNK_SIZE) {
      ensureCurrentRefresh(generation);
      const elapsed = Date.now() - startedAt;
      const remainingMs = chunkStart === 0 ? importTimeoutMs : Math.max(1, importTimeoutMs - elapsed);
      const chunkItems = processingItems.slice(chunkStart, chunkStart + METADATA_REFRESH_CHUNK_SIZE);
      const chunk = chunkItems.map(item => item.song);
      let currentChunkPartial = emptyMetadataRefreshResult(chunk, songs.length);
      try {
        const chunkResult = await withTimeoutImpl(
          signal => refreshSongsFromId3Impl(chunk, {
            signal,
            includeCover: false,
            concurrency: METADATA_REFRESH_ID3_CONCURRENCY,
            onProgress: processed => {
              const processedTotal = Math.min(songs.length, startIndex + result.processed + processed);
              const updatedTotal = result.updated + currentChunkPartial.updated;
              const skippedTotal = result.skipped + currentChunkPartial.skipped;
              const failedTotal = result.failed + currentChunkPartial.failed;
              setImportStatus(metadataRefreshProgressStatus({
                processed: processedTotal,
                total: songs.length,
                updated: updatedTotal,
                skipped: skippedTotal,
                failed: failedTotal,
              }));
              updateMetadataRefreshProgress({
                processed: processedTotal,
                total: songs.length,
                updated: updatedTotal,
                skipped: skippedTotal,
                failed: failedTotal,
                errorDetails: [...(result.errorDetails ?? []), ...(currentChunkPartial.errorDetails ?? [])],
                lastProcessedSongId: currentChunkPartial.lastProcessedSongId ?? result.lastProcessedSongId,
              });
            },
            onSongProcessed: processedSong => {
              currentChunkPartial = mergeProcessedSongIntoRefreshResult(currentChunkPartial, processedSong);
            },
          }),
          remainingMs,
          refreshCopy.timeoutMessage,
          { signal: generation.controller.signal },
        );
        result = mergeMetadataRefreshResult(result, chunkResult, chunkItems);
      } catch (error) {
        if (isMetadataRefreshPartialError(error)) {
          result = mergeMetadataRefreshResult(result, error.result, chunkItems);
          result = { ...result, completed: false, timedOut: error.result.timedOut || undefined, aborted: error.result.aborted || undefined };
          return completeOrResumePartialResult(result, startIndex, songs.length);
        }
        if (isTimeoutError(error) && currentChunkPartial.processed > 0) {
          result = mergeMetadataRefreshResult(
            result,
            { ...currentChunkPartial, completed: false, timedOut: true },
            chunkItems,
          );
          return completeOrResumePartialResult(result, startIndex, songs.length);
        }
        if (isTimeoutError(error) && result.processed > 0) {
          return completeOrResumePartialResult(result, startIndex, songs.length);
        }
        throw error;
      }
      if (chunkStart + METADATA_REFRESH_CHUNK_SIZE < processingItems.length) {
        await yieldToEventLoop();
      }
    }

    ensureCurrentRefresh(generation);
    return { ...result, completed: true, nextResumeIndex: 0 };
  }, [ensureCurrentRefresh, importTimeoutMs, refreshSongsFromId3Impl, setImportStatus, songs, withTimeoutImpl]);

  const commitMetadataRefreshProgress = useCallback((result: MetadataRefreshSongsResult): void => {
    if (result.completed) {
      resumeIndexRef.current = 0;
      updateMetadataRefreshProgress({ resumeIndex: 0 });
      return;
    }
    if (typeof result.nextResumeIndex === 'number') {
      resumeIndexRef.current = result.nextResumeIndex;
      updateMetadataRefreshProgress({ resumeIndex: result.nextResumeIndex });
    }
  }, []);

  return { runMetadataRefresh, commitMetadataRefreshProgress };
};
