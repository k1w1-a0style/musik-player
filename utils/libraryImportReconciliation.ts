import type { Song } from '../types/Song';
import { createSongMergeIndex, getSongMergeKeys, mergeSongPreservingRichMetadata } from './libraryPresentation';
import { sameSongSnapshot } from './songSnapshotEquality';

// Treat absent optional fields and explicit undefined alike. Compare source
// revisions and nested metadata as well as display fields, without key-order noise.
const indexSongs = (songs: Song[]): Map<string, Song> => {
  const index = new Map<string, Song>();
  for (const song of songs) for (const key of getSongMergeKeys(song)) index.set(key, song);
  return index;
};

const findSong = (index: Map<string, Song>, song: Song): Song | undefined => {
  const byId = index.get(`id:${song.id}`);
  if (byId) return byId;
  for (const key of getSongMergeKeys(song)) {
    const match = index.get(key);
    if (match) return match;
  }
  return undefined;
};

const acceptedImportInput = (expected: Map<string, Song>, current: ReturnType<typeof createSongMergeIndex>, incoming: Song): Song | undefined => {
  const previous = findSong(expected, incoming);
  const latest = current.find(incoming);
  if (previous && !latest) return undefined;
  if (latest && (!previous || !sameSongSnapshot(previous, latest))) return undefined;
  const canonical = latest ? { ...incoming, id: latest.id } : incoming;
  return latest && sameSongSnapshot(latest, mergeSongPreservingRichMetadata(latest, canonical)) ? undefined : canonical;
};

/** An import may advance only the versions it owns. Newer edits or deletions
 * remain authoritative across later checkpoints and final-result replays. */
export const createImportSongReconciler = (baselineSongs: Song[], sorted = true) => {
  const expected = indexSongs(baselineSongs);
  let currentIndex = createSongMergeIndex();
  let lastCurrent: Song[] | undefined;
  return (currentSongs: Song[], importedSongs: Song[]): Song[] => {
    if (currentSongs !== lastCurrent) currentIndex = createSongMergeIndex(currentSongs);
    const acceptedInputs: Song[] = [];
    for (const incoming of importedSongs) {
      const canonical = acceptedImportInput(expected, currentIndex, incoming);
      if (canonical) acceptedInputs.push(canonical);
    }
    currentIndex.addAll(acceptedInputs);
    const merged = acceptedInputs.length ? currentIndex.snapshot(sorted) : currentSongs;
    for (const incoming of acceptedInputs) {
      const accepted = currentIndex.find(incoming);
      if (!accepted) continue;
      const previous = findSong(expected, incoming);
      const keys = new Set([...getSongMergeKeys(incoming), ...getSongMergeKeys(accepted),
        ...(previous ? getSongMergeKeys(previous) : [])]);
      for (const key of keys) expected.set(key, accepted);
    }
    lastCurrent = merged;
    return merged;
  };
};
