import { useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Song } from '../types/Song';
import { getMetadataRefreshFlowCopy } from '../utils/libraryImportFlow';
import { isTimeoutError } from '../utils/withTimeout';
import { isMetadataRefreshPartialError } from '../utils/songMetadataRefresh';
import type { refreshSongsFromId3, SongMetadataRefreshProcessedSong, SongMetadataRefreshResult } from '../utils/songMetadataRefresh';
import type { MetadataRefreshGeneration, MetadataRefreshSongsResult, TimeoutRunner } from './libraryMetadataRefreshActionTypes';


const METADATA_REFRESH_CHUNK_SIZE = 25;
const yieldToEventLoop = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

interface MetadataRefreshProcessingItem {
  song: Song;
  originalIndex: number;
}

const emptyMetadataRefreshResult = (songs: Song[], total = songs.length): SongMetadataRefreshResult => ({
  songs,
  updated: 0,
  skipped: 0,
  failed: 0,
  errors: [],
  patchesBySongId: {},
  processed: 0,
  total,
  completed: false,
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
    patchesBySongId: { ...(current.patchesBySongId ?? {}), ...(chunkResult.patchesBySongId ?? {}) },
    processed: current.processed + (chunkResult.processed ?? chunkResult.songs.length),
    total: current.total,
    completed: false,
    timedOut: chunkResult.timedOut || current.timedOut || undefined,
    aborted: chunkResult.aborted || current.aborted || undefined,
    lastProcessedSongId: chunkResult.lastProcessedSongId ?? current.lastProcessedSongId,
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
    patchesBySongId: processedSong.patch
      ? { ...current.patchesBySongId, [processedSong.song.id]: processedSong.patch }
      : current.patchesBySongId,
    processed: current.processed + 1,
    total: current.total,
    completed: false,
    timedOut: current.timedOut,
    aborted: current.aborted,
    lastProcessedSongId: processedSong.song.id,
  };
};

const buildMetadataRefreshProcessingItems = (songs: Song[], startIndex: number): MetadataRefreshProcessingItem[] => [
  ...songs.slice(startIndex).map((song, offset) => ({ song, originalIndex: startIndex + offset })),
  ...songs.slice(0, startIndex).map((song, originalIndex) => ({ song, originalIndex })),
];

const advanceResumeIndex = (startIndex: number, processed: number, total: number): number =>
  total > 0 ? (startIndex + processed) % total : 0;

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
    const startIndex = resumeIndexRef.current < songs.length ? resumeIndexRef.current : 0;
    const processingItems = buildMetadataRefreshProcessingItems(songs, startIndex);
    let result = emptyMetadataRefreshResult(songs, songs.length);
    setImportStatus(refreshCopy.readingStatus);

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
            onProgress: processed => setImportStatus(`Metadaten ${result.processed + processed}/${songs.length}`),
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
          resumeIndexRef.current = advanceResumeIndex(startIndex, result.processed, songs.length);
          return result;
        }
        if (isTimeoutError(error) && currentChunkPartial.processed > 0) {
          result = mergeMetadataRefreshResult(
            result,
            { ...currentChunkPartial, completed: false, timedOut: true },
            chunkItems,
          );
          resumeIndexRef.current = advanceResumeIndex(startIndex, result.processed, songs.length);
          return { ...result, completed: false, timedOut: true };
        }
        if (isTimeoutError(error) && result.processed > 0) {
          resumeIndexRef.current = advanceResumeIndex(startIndex, result.processed, songs.length);
          return { ...result, completed: false, timedOut: true };
        }
        throw error;
      }
      resumeIndexRef.current = advanceResumeIndex(startIndex, result.processed, songs.length);
      if (chunkStart + METADATA_REFRESH_CHUNK_SIZE < processingItems.length) {
        await yieldToEventLoop();
      }
    }

    ensureCurrentRefresh(generation);
    resumeIndexRef.current = 0;
    return { ...result, completed: true };
  }, [ensureCurrentRefresh, importTimeoutMs, refreshSongsFromId3Impl, setImportStatus, songs, withTimeoutImpl]);

  return { runMetadataRefresh };
};
