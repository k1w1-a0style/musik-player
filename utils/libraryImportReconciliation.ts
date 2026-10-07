import type { Song } from '../types/Song';
import { getSongMergeKeys, mergeSongs } from './libraryPresentation';

// Treat absent optional fields and explicit undefined alike. Compare source
// revisions and nested metadata as well as display fields, without key-order noise.
const sameSnapshot = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].every(key => sameSnapshot(a[key], b[key]));
};

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

/** An import may advance only the versions it owns. Newer edits or deletions
 * remain authoritative across later checkpoints and final-result replays. */
export const createImportSongReconciler = (baselineSongs: Song[]) => {
  const expected = indexSongs(baselineSongs);
  return (currentSongs: Song[], importedSongs: Song[]): Song[] => {
    const current = indexSongs(currentSongs);
    const acceptedInputs: Song[] = [];
    for (const incoming of importedSongs) {
      const previous = findSong(expected, incoming);
      const latest = findSong(current, incoming);
      if (previous && !latest) continue;
      if (latest && (!previous || !sameSnapshot(previous, latest))) continue;
      // Keep playlist references stable when the provider rediscovers a URI
      // under another ID. The scan supplies metadata, not a new library identity.
      acceptedInputs.push(latest ? { ...incoming, id: latest.id } : incoming);
    }
    const merged = mergeSongs(currentSongs, acceptedInputs);
    const resultIndex = indexSongs(merged);
    for (const incoming of acceptedInputs) {
      const accepted = findSong(resultIndex, incoming);
      if (!accepted) continue;
      const previous = findSong(expected, incoming);
      const keys = new Set([...getSongMergeKeys(incoming), ...getSongMergeKeys(accepted),
        ...(previous ? getSongMergeKeys(previous) : [])]);
      for (const key of keys) expected.set(key, accepted);
    }
    return merged;
  };
};
