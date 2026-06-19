import { useEffect, useRef } from 'react';
import type { Song } from '../types/Song';
import type { SongMetadataPatchesById } from '../contexts/useLibraryActions';
import { backfillEmbeddedSongCovers, needsEmbeddedCoverBackfill } from '../utils/songCoverBackfill';
import { createCoverCacheProtection, type CoverCacheProtection } from '../utils/coverCacheCleanup';
import { getSongArtworkUri } from '../utils/songArtwork';

interface UseLibraryCoverBackfillOptions {
  songs: Song[];
  applySongMetadataPatches: (patchesBySongId: SongMetadataPatchesById) => void;
}

interface PendingCoverProtection {
  uris: Set<string>;
  release: () => void;
}

interface SafeBackfillPatchInput {
  originalSongs: Song[];
  resultSongs: Song[];
  currentSongs: Song[];
  candidateKeys: Set<string>;
}

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

export const useLibraryCoverBackfill = ({ songs, applySongMetadataPatches }: UseLibraryCoverBackfillOptions): void => {
  const generationRef = useRef(0);
  const attemptedRef = useRef(new Set<string>());
  const pendingProtectionsRef = useRef<PendingCoverProtection[]>([]);
  const mountedRef = useRef(true);
  const latestSongsRef = useRef(songs);

  latestSongsRef.current = songs;

  useEffect(() => {
    if (pendingProtectionsRef.current.length === 0) return;
    pendingProtectionsRef.current = pendingProtectionsRef.current.filter(pending => {
      const ownsAllUris = Array.from(pending.uris).every(uri => songSnapshotContainsUri(songs, uri));
      if (!ownsAllUris) return true;
      pending.release();
      return false;
    });
  }, [songs]);

  useEffect(() => () => {
    mountedRef.current = false;
    pendingProtectionsRef.current.forEach(pending => pending.release());
    pendingProtectionsRef.current = [];
  }, []);

  useEffect(() => {
    const candidates = songs.filter(song => needsEmbeddedCoverBackfill(song) && !attemptedRef.current.has(buildCoverBackfillAttemptKey(song)));
    if (candidates.length === 0) return undefined;

    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const controller = new AbortController();
    const protection = createCoverCacheProtection();
    const releaseProtection = createIdempotentProtectionRelease(protection);
    const candidateKeys = new Set(candidates.map(buildCoverBackfillAttemptKey));

    void backfillEmbeddedSongCovers(songs, {
      concurrency: 1,
      batchSize: 6,
      signal: controller.signal,
      coverCacheProtection: protection,
      shouldProcessSong: song => candidateKeys.has(buildCoverBackfillAttemptKey(song)),
    }).then(result => {
      if (
        !mountedRef.current
        || (!result.aborted && controller.signal.aborted)
        || result.attempted === 0
      ) {
        releaseProtection();
        return;
      }

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
      const hasPatches = Object.keys(patchesBySongId).length > 0;
      const protectedUris = getPatchCoverUris(patchesBySongId);
      if (hasPatches) {
        applySongMetadataPatches(patchesBySongId);
      }
      if (hasPatches && protectedUris.size > 0) pendingProtectionsRef.current.push({ uris: protectedUris, release: releaseProtection });
      else releaseProtection();
    }).catch(error => {
      releaseProtection();
      if (!controller.signal.aborted) console.warn('[LibraryCoverBackfill] Cover backfill failed.', error);
    });

    return () => {
      controller.abort();
    };
  }, [songs, applySongMetadataPatches]);
};
