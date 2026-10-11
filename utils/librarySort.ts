import type { Song } from '../types/Song';
import { displayArtist, displayTitle } from './libraryPresentation';
import { compareAlbumTracks } from './albumTrackOrder';

export type LibrarySortMode = 'alphabet' | 'trackNumber' | 'year' | 'recentlyAdded';

export const LIBRARY_SORT_MODES: readonly LibrarySortMode[] = [
  'alphabet',
  'trackNumber',
  'year',
  'recentlyAdded',
] as const;

export const DEFAULT_LIBRARY_SORT_MODE: LibrarySortMode = 'alphabet';

const LIBRARY_SORT_MODE_LABELS: Record<LibrarySortMode, string> = {
  alphabet: 'A–Z',
  trackNumber: 'Track',
  year: 'Jahr',
  recentlyAdded: 'Neueste',
};

export const isLibrarySortMode = (value: unknown): value is LibrarySortMode =>
  LIBRARY_SORT_MODES.includes(value as LibrarySortMode);

export const getLibrarySortModeLabel = (mode: LibrarySortMode): string => LIBRARY_SORT_MODE_LABELS[mode];

export const getNextLibrarySortMode = (mode: LibrarySortMode): LibrarySortMode => {
  const index = LIBRARY_SORT_MODES.indexOf(mode);
  return LIBRARY_SORT_MODES[(index + 1) % LIBRARY_SORT_MODES.length];
};

const parseLeadingInt = (value?: string): number | null => {
  if (!value) return null;
  const match = value.trim().match(/^\d+/);
  return match ? Number.parseInt(match[0], 10) : null;
};

const parseFiniteTimestamp = (value?: number): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const textOrder = new Intl.Collator('de', { sensitivity: 'base', numeric: true });
const compareText = textOrder.compare;

type SortKeys = { title: string; artist: string; year: number | null; importedAt: number | null };
// Library edits replace Song objects. Weak keys reuse unchanged sources across
// revisions without keeping removed songs or an unbounded revision registry.
const sortKeys = new WeakMap<Song, SortKeys>();
const getSortKeys = (song: Song): SortKeys => {
  let keys = sortKeys.get(song);
  if (!keys) {
    keys = { title: displayTitle(song), artist: displayArtist(song), year: parseLeadingInt(song.year),
      importedAt: parseFiniteTimestamp(song.fileInfo?.importedAt) };
    sortKeys.set(song, keys);
  }
  return keys;
};

// Missing/invalid numbers always sort to the end so unscanned tracks don't jump to the top.
const compareNumberNullsLast = (left: number | null, right: number | null): number => {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
};

// Missing/invalid timestamps sort to the end; newer imports appear first.
const compareTimestampDescNullsLast = (left: number | null, right: number | null): number => {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return right - left;
};

const compareByMode = (left: SortKeys, right: SortKeys, mode: LibrarySortMode): number => {
  if (mode === 'year') {
    return compareNumberNullsLast(left.year, right.year) || compareText(left.title, right.title);
  }

  if (mode === 'recentlyAdded') {
    return compareTimestampDescNullsLast(left.importedAt, right.importedAt) || compareText(left.title, right.title);
  }

  return compareText(left.title, right.title) || compareText(left.artist, right.artist);
};

export const sortLibrarySongs = (songs: Song[], mode: LibrarySortMode): Song[] => {
  if (mode === 'trackNumber') return [...songs].sort(compareAlbumTracks);
  const decorated = songs.map((song, index) => ({ song, index, keys: getSortKeys(song) }));
  decorated.sort((a, b) => compareByMode(a.keys, b.keys, mode) || (a.index - b.index));
  return decorated.map(entry => entry.song);
};
