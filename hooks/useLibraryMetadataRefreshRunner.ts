import { useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Song } from '../types/Song';
import { getMetadataRefreshFlowCopy } from '../utils/libraryImportFlow';
import { isTimeoutError } from '../utils/withTimeout';
import { isMetadataRefreshPartialError } from '../utils/songMetadataRefresh';
import type { refreshSongsFromId3, SongMetadataRefreshResult } from '../utils/songMetadataRefresh';
import type { MetadataRefreshGeneration, MetadataRefreshSongsResult, TimeoutRunner } from './libraryMetadataRefreshActionTypes';


const METADATA_REFRESH_CHUNK_SIZE = 25;
const yieldToEventLoop = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

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
  startIndex: number,
  allSongs: Song[],
): SongMetadataRefreshResult => {
  const mergedSongs = [...current.songs];
  for (let index = 0; index < chunkResult.songs.length; index += 1) {
    mergedSongs[startIndex + index] = chunkResult.songs[index];
  }
  return {
    songs: mergedSongs,
    updated: current.updated + chunkResult.updated,
    skipped: current.skipped + chunkResult.skipped,
    failed: current.failed + chunkResult.failed,
    errors: [...(current.errors ?? []), ...(chunkResult.errors ?? [])],
    patchesBySongId: { ...(current.patchesBySongId ?? {}), ...(chunkResult.patchesBySongId ?? {}) },
    processed: current.processed + (chunkResult.processed ?? chunkResult.songs.length),
    total: allSongs.length,
    completed: false,
    timedOut: chunkResult.timedOut || current.timedOut || undefined,
    aborted: chunkResult.aborted || current.aborted || undefined,
    lastProcessedSongId: chunkResult.lastProcessedSongId ?? current.lastProcessedSongId,
  };
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
    const startIndex = resumeIndexRef.current < songs.length ? resumeIndexRef.current : 0;
    const orderedSongs = [...songs.slice(startIndex), ...songs.slice(0, startIndex)];
    let result = emptyMetadataRefreshResult(orderedSongs, songs.length);
    setImportStatus(refreshCopy.readingStatus);

    for (let chunkStart = 0; chunkStart < orderedSongs.length; chunkStart += METADATA_REFRESH_CHUNK_SIZE) {
      ensureCurrentRefresh(generation);
      const elapsed = Date.now() - startedAt;
      const remainingMs = chunkStart === 0 ? importTimeoutMs : Math.max(1, importTimeoutMs - elapsed);
      const chunk = orderedSongs.slice(chunkStart, chunkStart + METADATA_REFRESH_CHUNK_SIZE);
      try {
        const chunkResult = await withTimeoutImpl(
          signal => refreshSongsFromId3Impl(chunk, {
            signal,
            includeCover: false,
            onProgress: processed => setImportStatus(`Metadaten ${result.processed + processed}/${songs.length}`),
          }),
          remainingMs,
          refreshCopy.timeoutMessage,
          { signal: generation.controller.signal },
        );
        result = mergeMetadataRefreshResult(result, chunkResult, chunkStart, orderedSongs);
      } catch (error) {
        if (isMetadataRefreshPartialError(error)) {
          result = mergeMetadataRefreshResult(result, error.result, chunkStart, orderedSongs);
          result = { ...result, completed: false, timedOut: error.result.timedOut || undefined, aborted: error.result.aborted || undefined };
          resumeIndexRef.current = (startIndex + result.processed) % songs.length;
          return result;
        }
        if (isTimeoutError(error) && result.processed > 0) {
          resumeIndexRef.current = (startIndex + result.processed) % songs.length;
          return { ...result, completed: false, timedOut: true };
        }
        throw error;
      }
      resumeIndexRef.current = (startIndex + result.processed) % songs.length;
      if (chunkStart + METADATA_REFRESH_CHUNK_SIZE < orderedSongs.length) {
        await yieldToEventLoop();
      }
    }

    ensureCurrentRefresh(generation);
    resumeIndexRef.current = 0;
    return { ...result, completed: true };
  }, [ensureCurrentRefresh, importTimeoutMs, refreshSongsFromId3Impl, setImportStatus, songs, withTimeoutImpl]);

  return { runMetadataRefresh };
};
