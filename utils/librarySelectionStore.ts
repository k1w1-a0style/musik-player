import type { Song } from '../types/Song';
import { getSongSourceKey } from './songSourceIdentity';

export interface LibrarySelectionSnapshot {
  readonly active: boolean;
  readonly count: number;
  readonly visibleCount: number;
  readonly songIds: readonly string[];
}
interface SelectedSource { id: string; revision: string; }

export const librarySelectionKey = (song: Song): string =>
  getSongSourceKey(song.fileInfo?.uri ?? song.uri) ?? `id:${song.id}`;

export const librarySelectionRevision = (song: Song): string => JSON.stringify([
  song.fileInfo?.size ?? null, song.fileInfo?.modificationTime ?? null,
  song.fileInfo?.contentHash ?? null,
]);

const uniqueSources = (songs: readonly Song[]): Map<string, Song> => {
  const map = new Map<string, Song>();
  for (const song of songs) if (!map.has(librarySelectionKey(song))) map.set(librarySelectionKey(song), song);
  return map;
};

const visibleSources = (songs: readonly Song[], sources: Map<string, Song>): Map<string, Song> => {
  const visible = new Map<string, Song>();
  for (const [key, song] of uniqueSources(songs)) {
    const current = sources.get(key);
    if (current && librarySelectionRevision(current) === librarySelectionRevision(song)) visible.set(key, current);
  }
  return visible;
};

export const createLibrarySelectionStore = () => {
  let sources = new Map<string, Song>();
  let visible = new Map<string, Song>();
  let songsById = new Map<string, Song>();
  let active = false;
  const selected = new Map<string, SelectedSource>();
  const listeners = new Set<() => void>();
  let snapshot: LibrarySelectionSnapshot = Object.freeze({ active, count: 0, visibleCount: 0, songIds: Object.freeze([]) });

  const publish = () => {
    const songIds = [...selected.values()].map(receipt => receipt.id);
    snapshot = Object.freeze({ active, count: songIds.length, visibleCount: visible.size, songIds: Object.freeze(songIds) });
    listeners.forEach(listener => listener());
  };
  const add = (song: Song) => {
    const key = librarySelectionKey(song);
    const current = sources.get(key);
    if (current && librarySelectionRevision(current) === librarySelectionRevision(song)) {
      selected.set(key, { id: current.id, revision: librarySelectionRevision(current) });
    }
  };
  const reconcile = (songs: readonly Song[], visibleSongs: readonly Song[]) => {
    sources = uniqueSources(songs); visible = visibleSources(visibleSongs, sources);
    songsById = new Map(songs.map(song => [song.id, song]));
    for (const [key, receipt] of selected) {
      const current = songsById.get(receipt.id);
      if (!current || librarySelectionKey(current) !== key || librarySelectionRevision(current) !== receipt.revision) selected.delete(key);
    }
    publish();
  };
  return {
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => snapshot,
    getRowSnapshot: (song: Song): 0 | 1 | 2 => {
      if (!active) return 0;
      return selected.has(librarySelectionKey(song)) ? 2 : 1;
    },
    reconcile,
    start: (song?: Song) => { active = true; if (song) add(song); publish(); },
    toggle: (song: Song) => {
      active = true; const key = librarySelectionKey(song);
      if (selected.has(key)) selected.delete(key); else add(song);
      publish();
    },
    selectVisible: () => { active = true; visible.forEach(add); publish(); },
    clear: () => { selected.clear(); publish(); },
    close: () => { active = false; selected.clear(); publish(); },
    getCurrentIds: () => snapshot.songIds.slice(),
  };
};
export type LibrarySelectionStore = ReturnType<typeof createLibrarySelectionStore>;
