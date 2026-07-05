import type { Song } from '../types/Song';
import { displayArtist, displayTitle } from './libraryPresentation';

export type LibrarySortMode = 'alphabet' | 'trackNumber' | 'year';

export const LIBRARY_SORT_MODES: readonly LibrarySortMode[] = ['alphabet', 'trackNumber', 'year'] as const;

export const DEFAULT_LIBRARY_SORT_MODE: LibrarySortMode = 'alphabet';

const LIBRARY_SORT_MODE_LABELS: Record<LibrarySortMode, string> = {
  alphabet: 'A–Z',
  trackNumber: 'Track',
  year: 'Jahr',
};

export const isLibrarySortMode = (value: unknown): value is LibrarySortMode =>
  value === 'alphabet' || value === 'trackNumber' || value === 'year';

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

const compareText = (left: string, right: string): number =>
  left.localeCompare(right, 'de', { sensitivity: 'base', numeric: true });

// Missing/invalid numbers always sort to the end so unscanned tracks don't jump to the top.
const compareNumberNullsLast = (left: number | null, right: number | null): number => {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
};

const compareByMode = (left: Song, right: Song, mode: LibrarySortMode): number => {
  const leftTitle = displayTitle(left);
  const rightTitle = displayTitle(right);

  if (mode === 'trackNumber') {
    return compareNumberNullsLast(parseLeadingInt(left.trackNumber), parseLeadingInt(right.trackNumber))
      || compareText(leftTitle, rightTitle);
  }

  if (mode === 'year') {
    return compareNumberNullsLast(parseLeadingInt(left.year), parseLeadingInt(right.year))
      || compareText(leftTitle, rightTitle);
  }

  return compareText(leftTitle, rightTitle) || compareText(displayArtist(left), displayArtist(right));
};

export const sortLibrarySongs = (songs: Song[], mode: LibrarySortMode): Song[] => {
  const decorated = songs.map((song, index) => ({ song, index }));
  decorated.sort((a, b) => compareByMode(a.song, b.song, mode) || (a.index - b.index));
  return decorated.map(entry => entry.song);
};
