import { useEffect, useRef } from 'react';
import type { Song } from '../types/Song';
import type { SongMetadataPatchesById } from '../contexts/useLibraryActions';
import { backfillEmbeddedSongCovers, needsEmbeddedCoverBackfill } from '../utils/songCoverBackfill';
import { getSongArtworkUri } from '../utils/songArtwork';

interface UseLibraryCoverBackfillOptions {
  songs: Song[];
  setSongs: (songs: Song[]) => void;
  applySongMetadataPatches?: (patchesBySongId: SongMetadataPatchesById) => void;
}

const buildAttemptKey = (song: Song): string => song.id || song.uri || song.fileInfo?.uri || `${song.title}:${song.artist}`;

export const useLibraryCoverBackfill = ({ songs, setSongs, applySongMetadataPatches }: UseLibraryCoverBackfillOptions): void => {
  const generationRef = useRef(0);
  const attemptedRef = useRef(new Set<string>());

  useEffect(() => {
    const candidates = songs.filter(song => needsEmbeddedCoverBackfill(song) && !attemptedRef.current.has(buildAttemptKey(song)));
    if (candidates.length === 0) return undefined;

    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const controller = new AbortController();
    const candidateKeys = new Set(candidates.map(buildAttemptKey));

    void backfillEmbeddedSongCovers(songs, {
      concurrency: 1,
      batchSize: 6,
      signal: controller.signal,
      shouldProcessSong: song => candidateKeys.has(buildAttemptKey(song)),
    }).then(result => {
      if (controller.signal.aborted || generationRef.current !== generation || result.attempted === 0) return;
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
      if (applySongMetadataPatches && hasPatches) applySongMetadataPatches(patchesBySongId);
      else if (hasPatches) setSongs(merged);
    }).catch(error => {
      if (!controller.signal.aborted) console.warn('[LibraryCoverBackfill] Cover backfill failed.', error);
    });

    return () => {
      controller.abort();
    };
  }, [setSongs, songs, applySongMetadataPatches]);
};
