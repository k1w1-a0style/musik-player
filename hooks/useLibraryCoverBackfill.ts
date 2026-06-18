import { useEffect, useRef } from 'react';
import type { Song } from '../types/Song';
import type { SongMetadataPatchesById } from '../contexts/useLibraryActions';
import { backfillEmbeddedSongCovers, needsEmbeddedCoverBackfill } from '../utils/songCoverBackfill';
import { createCoverCacheProtection, type CoverCacheProtection } from '../utils/coverCacheCleanup';
import { getSongArtworkUri } from '../utils/songArtwork';

interface UseLibraryCoverBackfillOptions {
  songs: Song[];
  setSongs: (songs: Song[]) => void;
  applySongMetadataPatches?: (patchesBySongId: SongMetadataPatchesById) => void;
}

interface PendingCoverProtection {
  uris: Set<string>;
  release: () => void;
}

const buildAttemptKey = (song: Song): string => song.id || song.uri || song.fileInfo?.uri || `${song.title}:${song.artist}`;

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

export const useLibraryCoverBackfill = ({ songs, setSongs, applySongMetadataPatches }: UseLibraryCoverBackfillOptions): void => {
  const generationRef = useRef(0);
  const attemptedRef = useRef(new Set<string>());
  const pendingProtectionsRef = useRef<PendingCoverProtection[]>([]);

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
    pendingProtectionsRef.current.forEach(pending => pending.release());
    pendingProtectionsRef.current = [];
  }, []);

  useEffect(() => {
    const candidates = songs.filter(song => needsEmbeddedCoverBackfill(song) && !attemptedRef.current.has(buildAttemptKey(song)));
    if (candidates.length === 0) return undefined;

    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const controller = new AbortController();
    const protection = createCoverCacheProtection();
    const releaseProtection = createIdempotentProtectionRelease(protection);
    const candidateKeys = new Set(candidates.map(buildAttemptKey));

    void backfillEmbeddedSongCovers(songs, {
      concurrency: 1,
      batchSize: 6,
      signal: controller.signal,
      coverCacheProtection: protection,
      shouldProcessSong: song => candidateKeys.has(buildAttemptKey(song)),
    }).then(result => {
      if (controller.signal.aborted || generationRef.current !== generation || result.attempted === 0) {
        releaseProtection();
        return;
      }
      const merged = songs.map((song, index) => {
        const next = result.songs[index];
        const nextArtwork = getSongArtworkUri(next);
        if (!nextArtwork && next.coverInfo?.status !== 'none') return song;
        if (!needsEmbeddedCoverBackfill(song)) return song;
        return next;
      });
      const patchesBySongId: SongMetadataPatchesById = {};
      merged.forEach((song, index) => {
        if (song === songs[index]) return;
        attemptedRef.current.add(buildAttemptKey(songs[index]));
        patchesBySongId[song.id] = {
          cover: song.cover,
          coverInfo: song.coverInfo,
        };
      });
      const hasPatches = Object.keys(patchesBySongId).length > 0;
      const protectedUris = getPatchCoverUris(patchesBySongId);
      if (applySongMetadataPatches && hasPatches) applySongMetadataPatches(patchesBySongId);
      else if (hasPatches) setSongs(merged);
      if (hasPatches && protectedUris.size > 0) pendingProtectionsRef.current.push({ uris: protectedUris, release: releaseProtection });
      else releaseProtection();
    }).catch(error => {
      releaseProtection();
      if (!controller.signal.aborted) console.warn('[LibraryCoverBackfill] Cover backfill failed.', error);
    });

    return () => {
      controller.abort();
    };
  }, [setSongs, songs, applySongMetadataPatches]);
};
