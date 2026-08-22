import { useEffect, useRef } from 'react';
import type { Song } from '../types/Song';
import type { SongMetadataPatchesById } from '../contexts/useLibraryActions';
import { backfillEmbeddedSongCovers, needsEmbeddedCoverBackfill } from '../utils/songCoverBackfill';
import { createCoverCacheProtection, type CoverCacheProtection } from '../utils/coverCacheCleanup';
import { getSongArtworkUri } from '../utils/songArtwork';
import { useMetadataRefreshActive } from '../utils/metadataRefreshActivity';

interface UseLibraryCoverBackfillOptions {
  songs: Song[];
  applySongMetadataPatches: (patchesBySongId: SongMetadataPatchesById) => void;
  enabled?: boolean;
}

interface PendingCoverProtection {
  uris: Set<string>;
  release: () => void;
  completed: boolean;
}

interface SafeBackfillPatchInput {
  originalSongs: Song[];
  resultSongs: Song[];
  currentSongs: Song[];
  candidateKeys: Set<string>;
}

const PROGRESSIVE_COVER_PATCH_BATCH_SIZE = 4;
const PROGRESSIVE_COVER_PATCH_FLUSH_MS = 750;
const NO_BACKFILL_SONGS: Song[] = [];

const selectBackfillSongs = (songs: Song[], enabled: boolean): Song[] =>
  enabled ? songs : NO_BACKFILL_SONGS;

export const buildCoverBackfillAttemptKey = (song: Song): string =>
  [
    song.id,
    song.uri ?? '',
    song.fileInfo?.uri ?? '',
    song.coverInfo?.status ?? '',
    song.coverInfo?.embeddedArtworkChecked === true ? 'checked' : 'unchecked',
    song.coverInfo?.embeddedArtworkRevision ?? '',
  ].join('|');

const songSnapshotContainsUri = (songs: Song[], uri: string): boolean =>
  songs.some(song => song.cover === uri || song.coverInfo?.uri === uri);

const getPatchCoverUris = (patchesBySongId: SongMetadataPatchesById): Set<string> => {
  const uris = new Set<string>();
  Object.values(patchesBySongId).forEach(patch => {
    if (patch.cover) uris.add(patch.cover);
    if (patch.coverInfo?.uri) uris.add(patch.coverInfo.uri);
  });
  return uris;
};

const releaseOwnedPendingProtections = (pendingProtections: PendingCoverProtection[], songs: Song[]): PendingCoverProtection[] =>
  pendingProtections.filter(pending => {
    const ownsAllUris = Array.from(pending.uris).every(uri => songSnapshotContainsUri(songs, uri));
    if (!pending.completed || !ownsAllUris) return true;
    pending.release();
    return false;
  });

const createIdempotentProtectionRelease = (protection: CoverCacheProtection): (() => void) => {
  let protectionReleased = false;
  return (): void => {
    if (protectionReleased) return;
    protectionReleased = true;
    protection.release();
  };
};

const buildSafeBackfillPatches = ({
  originalSongs,
  resultSongs,
  currentSongs,
  candidateKeys,
}: SafeBackfillPatchInput): SongMetadataPatchesById => {
  const currentSongsById = new Map(currentSongs.map(song => [song.id, song]));
  const patchesBySongId: SongMetadataPatchesById = {};

  originalSongs.forEach((originalSong, index) => {
    const originalAttemptKey = buildCoverBackfillAttemptKey(originalSong);
    if (!candidateKeys.has(originalAttemptKey)) return;

    const resultSong = resultSongs[index];
    if (!resultSong || resultSong === originalSong) return;

    const currentSong = currentSongsById.get(originalSong.id);
    if (!currentSong) return;
    if (buildCoverBackfillAttemptKey(currentSong) !== originalAttemptKey) return;
    if (!needsEmbeddedCoverBackfill(currentSong)) return;

    const resultArtwork = getSongArtworkUri(resultSong);
    if (!resultArtwork && resultSong.coverInfo?.status !== 'none') return;

    patchesBySongId[originalSong.id] = {
      cover: resultSong.cover,
      coverInfo: resultSong.coverInfo,
    };
  });

  return patchesBySongId;
};

export const useLibraryCoverBackfill = ({ songs, applySongMetadataPatches, enabled = true }: UseLibraryCoverBackfillOptions): void => {
  const generationRef = useRef(0);
  const attemptedRef = useRef(new Set<string>());
  const pendingProtectionsRef = useRef<PendingCoverProtection[]>([]);
  const mountedRef = useRef(true);
  const latestSongsRef = useRef(songs);
  const metadataRefreshActive = useMetadataRefreshActive();
  const backfillSongs = selectBackfillSongs(songs, enabled);

  latestSongsRef.current = songs;

  useEffect(() => {
    if (pendingProtectionsRef.current.length === 0) return;
    pendingProtectionsRef.current = releaseOwnedPendingProtections(pendingProtectionsRef.current, songs);
  }, [songs]);

  useEffect(() => () => {
    mountedRef.current = false;
    pendingProtectionsRef.current.forEach(pending => pending.release());
    pendingProtectionsRef.current = [];
  }, []);

  useEffect(() => {
    // Pause while a user-triggered manual metadata refresh runs exclusively.
    if (metadataRefreshActive) return undefined;
    const candidates = backfillSongs.filter(song => needsEmbeddedCoverBackfill(song) && !attemptedRef.current.has(buildCoverBackfillAttemptKey(song)));
    if (candidates.length === 0) return undefined;

    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const controller = new AbortController();
    const protection = createCoverCacheProtection();
    const releaseProtection = createIdempotentProtectionRelease(protection);
    const candidateKeys = new Set(candidates.map(buildCoverBackfillAttemptKey));
    const pendingPatches: SongMetadataPatchesById = {};
    const flushedSongIds = new Set<string>();
    let lastFlushAt = Date.now();
    let protectionHandedToPending = false;
    let runPendingProtection: PendingCoverProtection | undefined;

    const ensureRunPendingProtection = (): PendingCoverProtection => {
      if (runPendingProtection) return runPendingProtection;
      protectionHandedToPending = true;
      runPendingProtection = { uris: new Set<string>(), release: releaseProtection, completed: false };
      pendingProtectionsRef.current.push(runPendingProtection);
      return runPendingProtection;
    };

    const markRunProtectionComplete = (): void => {
      if (!runPendingProtection) return;
      runPendingProtection.completed = true;
      pendingProtectionsRef.current = releaseOwnedPendingProtections(pendingProtectionsRef.current, latestSongsRef.current);
    };

    const flushProgressivePatches = (): void => {
      if (!mountedRef.current || generationRef.current !== generation || controller.signal.aborted) return;
      const patchIds = Object.keys(pendingPatches);
      if (patchIds.length === 0) return;
      const patches = { ...pendingPatches };
      patchIds.forEach(songId => {
        delete pendingPatches[songId];
        flushedSongIds.add(songId);
      });
      const protectedUris = getPatchCoverUris(patches);
      applySongMetadataPatches(patches);
      if (protectedUris.size > 0) {
        const pendingProtection = ensureRunPendingProtection();
        protectedUris.forEach(uri => pendingProtection.uris.add(uri));
      }
      lastFlushAt = Date.now();
    };

    const queueProgressivePatch = (patchedSong: Song, index: number): void => {
      if (!mountedRef.current || generationRef.current !== generation || controller.signal.aborted) return;
      const originalSong = songs[index];
      if (!originalSong || flushedSongIds.has(originalSong.id)) return;
      const patches = buildSafeBackfillPatches({
        originalSongs: [originalSong],
        resultSongs: [patchedSong],
        currentSongs: latestSongsRef.current,
        candidateKeys,
      });
      const patch = patches[originalSong.id];
      if (!patch) return;
      pendingPatches[originalSong.id] = patch;
      attemptedRef.current.add(buildCoverBackfillAttemptKey(originalSong));
      const shouldFlushBySize = Object.keys(pendingPatches).length >= PROGRESSIVE_COVER_PATCH_BATCH_SIZE;
      const shouldFlushByTime = Date.now() - lastFlushAt >= PROGRESSIVE_COVER_PATCH_FLUSH_MS;
      if (shouldFlushBySize || shouldFlushByTime) flushProgressivePatches();
    };

    void backfillEmbeddedSongCovers(songs, {
      concurrency: 2,
      batchSize: 6,
      signal: controller.signal,
      coverCacheProtection: protection,
      shouldProcessSong: song => candidateKeys.has(buildCoverBackfillAttemptKey(song)),
      onSongProcessed: queueProgressivePatch,
    }).then(result => {
      if (
        !mountedRef.current
        || (!result.aborted && controller.signal.aborted)
        || result.attempted === 0
      ) {
        markRunProtectionComplete();
        if (!protectionHandedToPending) releaseProtection();
        return;
      }

      flushProgressivePatches();
      const patchesBySongId = buildSafeBackfillPatches({
        originalSongs: songs,
        resultSongs: result.songs,
        currentSongs: result.aborted ? latestSongsRef.current : songs,
        candidateKeys,
      });
      Object.keys(patchesBySongId).forEach(songId => {
        const originalSong = songs.find(song => song.id === songId);
        if (originalSong) attemptedRef.current.add(buildCoverBackfillAttemptKey(originalSong));
      });
      Object.keys(patchesBySongId).forEach(songId => {
        if (flushedSongIds.has(songId)) delete patchesBySongId[songId];
      });
      const hasPatches = Object.keys(patchesBySongId).length > 0;
      const protectedUris = getPatchCoverUris(patchesBySongId);
      if (hasPatches) {
        applySongMetadataPatches(patchesBySongId);
      }
      if (hasPatches && protectedUris.size > 0) {
        const pendingProtection = ensureRunPendingProtection();
        protectedUris.forEach(uri => pendingProtection.uris.add(uri));
      }
      markRunProtectionComplete();
      if (!protectionHandedToPending) releaseProtection();
    }).catch(error => {
      releaseProtection();
      if (!controller.signal.aborted) console.warn('[LibraryCoverBackfill] Cover backfill failed.', error);
    });

    return () => controller.abort();
  }, [songs, backfillSongs, applySongMetadataPatches, metadataRefreshActive]);
};
