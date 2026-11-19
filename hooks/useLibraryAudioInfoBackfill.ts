import { useEffect, useRef } from 'react';
import type { Song } from '../types/Song';
import type { SongMetadataPatch, SongMetadataPatchesById } from '../contexts/useLibraryActions';
import {
  backfillExistingSongAudioInfo,
  audioInfoRetryIsDeferred,
  buildAudioInfoBackfillAttemptKey,
  needsAudioInfoBackfill,
  nextAudioInfoRetryAt,
} from '../utils/songAudioInfoBackfill';
import { useMetadataRefreshActive } from '../utils/metadataRefreshActivity';
import { useAfterInitialInteractions } from './useAfterInitialInteractions';
import { useCoverRetryWake } from './useCoverRetryWake';

interface UseLibraryAudioInfoBackfillOptions {
  songs: Song[];
  applySongMetadataPatches: (patchesBySongId: SongMetadataPatchesById) => void;
  enabled?: boolean;
}

interface SafeAudioInfoPatchInput {
  originalSongs: Song[];
  resultSongs: Song[];
  currentSongs: Song[];
  candidateKeys: Set<string>;
}

const PROGRESSIVE_AUDIO_INFO_PATCH_BATCH_SIZE = 6;
const PROGRESSIVE_AUDIO_INFO_PATCH_FLUSH_MS = 750;
const NO_BACKFILL_SONGS: Song[] = [];

const selectBackfillSongs = (songs: Song[], enabled: boolean, afterInitialInteractions: boolean): Song[] =>
  enabled && afterInitialInteractions ? songs : NO_BACKFILL_SONGS;

const shallowEqual = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

const buildAudioInfoPatch = (currentSong: Song, patchedSong: Song): SongMetadataPatch | undefined => {
  const patch: SongMetadataPatch = {};

  if (currentSong.duration !== patchedSong.duration) patch.duration = patchedSong.duration;
  if (patchedSong.fileInfo && !shallowEqual(currentSong.fileInfo, patchedSong.fileInfo)) {
    const { filename, mimeType, size } = patchedSong.fileInfo;
    patch.audioFileInfo = { filename, mimeType, size };
  }
  if (!shallowEqual(currentSong.audioInfo, patchedSong.audioInfo)) patch.audioInfo = patchedSong.audioInfo;

  return Object.keys(patch).length > 0 ? patch : undefined;
};

export const buildSafeAudioInfoBackfillPatches = ({
  originalSongs,
  resultSongs,
  currentSongs,
  candidateKeys,
}: SafeAudioInfoPatchInput): SongMetadataPatchesById => {
  const currentSongsById = new Map(currentSongs.map(song => [song.id, song]));
  const patchesBySongId: SongMetadataPatchesById = {};

  originalSongs.forEach((originalSong, index) => {
    const originalAttemptKey = buildAudioInfoBackfillAttemptKey(originalSong);
    if (!candidateKeys.has(originalAttemptKey)) return;

    const resultSong = resultSongs[index];
    if (!resultSong || resultSong === originalSong) return;

    const currentSong = currentSongsById.get(originalSong.id);
    if (!currentSong) return;
    if (buildAudioInfoBackfillAttemptKey(currentSong) !== originalAttemptKey) return;
    if (!needsAudioInfoBackfill(currentSong)) return;

    const patch = buildAudioInfoPatch(currentSong, resultSong);
    if (!patch) return;
    patchesBySongId[originalSong.id] = patch;
  });

  return patchesBySongId;
};

export const useLibraryAudioInfoBackfill = ({ songs, applySongMetadataPatches, enabled = true }: UseLibraryAudioInfoBackfillOptions): void => {
  const generationRef = useRef(0);
  const attemptedRef = useRef(new Set<string>());
  const mountedRef = useRef(true);
  const latestSongsRef = useRef(songs);
  const metadataRefreshActive = useMetadataRefreshActive();
  const afterInitialInteractions = useAfterInitialInteractions();
  const backfillSongs = selectBackfillSongs(songs, enabled, afterInitialInteractions);
  const retryWake = useCoverRetryWake(backfillSongs, nextAudioInfoRetryAt);

  latestSongsRef.current = songs;

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  useEffect(() => {
    // Pause while a user-triggered manual metadata refresh runs exclusively.
    if (metadataRefreshActive) return undefined;
    const candidates = backfillSongs.filter(song => {
      const key = buildAudioInfoBackfillAttemptKey(song);
      return needsAudioInfoBackfill(song) && !audioInfoRetryIsDeferred(song) && !attemptedRef.current.has(key);
    });
    if (candidates.length === 0) return undefined;

    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const controller = new AbortController();
    const candidateKeys = new Set(candidates.map(buildAudioInfoBackfillAttemptKey));
    const pendingPatches: SongMetadataPatchesById = {};
    const flushedSongIds = new Set<string>();
    let lastFlushAt = Date.now();

    const flushProgressivePatches = (): void => {
      if (!mountedRef.current || generationRef.current !== generation || controller.signal.aborted) return;
      const patchIds = Object.keys(pendingPatches);
      if (patchIds.length === 0) return;

      const patches = { ...pendingPatches };
      patchIds.forEach(songId => {
        delete pendingPatches[songId];
        flushedSongIds.add(songId);
      });
      applySongMetadataPatches(patches);
      lastFlushAt = Date.now();
    };

    const queueProgressivePatch = (patchedSong: Song, index: number): void => {
      if (!mountedRef.current || generationRef.current !== generation || controller.signal.aborted) return;
      const originalSong = candidates[index];
      if (!originalSong || flushedSongIds.has(originalSong.id)) return;

      const patches = buildSafeAudioInfoBackfillPatches({
        originalSongs: [originalSong],
        resultSongs: [patchedSong],
        currentSongs: latestSongsRef.current,
        candidateKeys,
      });
      const patch = patches[originalSong.id];
      if (!patch) return;

      pendingPatches[originalSong.id] = patch;
      attemptedRef.current.add(buildAudioInfoBackfillAttemptKey(originalSong));
      const shouldFlushBySize = Object.keys(pendingPatches).length >= PROGRESSIVE_AUDIO_INFO_PATCH_BATCH_SIZE;
      const shouldFlushByTime = Date.now() - lastFlushAt >= PROGRESSIVE_AUDIO_INFO_PATCH_FLUSH_MS;
      if (shouldFlushBySize || shouldFlushByTime) flushProgressivePatches();
    };

    void backfillExistingSongAudioInfo(candidates, {
      concurrency: 2,
      batchSize: 8,
      signal: controller.signal,
      recordRetry: true,
      shouldProcessSong: song => candidateKeys.has(buildAudioInfoBackfillAttemptKey(song)),
      onSongProcessed: queueProgressivePatch,
    }).then(result => {
      if (
        !mountedRef.current
        || (!result.aborted && controller.signal.aborted)
        || result.attempted === 0
      ) {
        return;
      }

      flushProgressivePatches();
      const patchesBySongId = buildSafeAudioInfoBackfillPatches({
        originalSongs: candidates,
        resultSongs: result.songs,
        currentSongs: latestSongsRef.current,
        candidateKeys,
      });

      Object.keys(patchesBySongId).forEach(songId => {
        if (flushedSongIds.has(songId)) delete patchesBySongId[songId];
      });

      if (Object.keys(patchesBySongId).length > 0) {
        applySongMetadataPatches(patchesBySongId);
      }
    }).catch(error => {
      if (!controller.signal.aborted) console.warn('[LibraryAudioInfoBackfill] AudioInfo backfill failed.', error);
    });

    return () => controller.abort();
  }, [songs, backfillSongs, applySongMetadataPatches, metadataRefreshActive, retryWake]);
};
