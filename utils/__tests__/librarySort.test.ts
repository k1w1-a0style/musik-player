import type { Song } from '../../types/Song';
import {
  DEFAULT_LIBRARY_SORT_MODE,
  LIBRARY_SORT_MODES,
  getLibrarySortModeLabel,
  getNextLibrarySortMode,
  isLibrarySortMode,
  sortLibrarySongs,
} from '../librarySort';

const makeSong = (overrides: Partial<Song>): Song => ({
  id: overrides.id ?? Math.random().toString(),
  title: overrides.title ?? 'Title',
  artist: overrides.artist ?? 'Artist',
  ...overrides,
});

describe('librarySort', () => {
  test('default mode and mode guards', () => {
    expect(DEFAULT_LIBRARY_SORT_MODE).toBe('alphabet');
    expect(LIBRARY_SORT_MODES).toEqual(['alphabet', 'trackNumber', 'year']);
    expect(isLibrarySortMode('year')).toBe(true);
    expect(isLibrarySortMode('nope')).toBe(false);
  });

  test('cycles through the modes', () => {
    expect(getNextLibrarySortMode('alphabet')).toBe('trackNumber');
    expect(getNextLibrarySortMode('trackNumber')).toBe('year');
    expect(getNextLibrarySortMode('year')).toBe('alphabet');
  });

  test('exposes short labels', () => {
    expect(getLibrarySortModeLabel('alphabet')).toBe('A–Z');
    expect(getLibrarySortModeLabel('trackNumber')).toBe('Track');
    expect(getLibrarySortModeLabel('year')).toBe('Jahr');
  });

  test('sorts alphabetically by title (case-insensitive) without mutating input', () => {
    const songs = [
      makeSong({ id: '1', title: 'banana' }),
      makeSong({ id: '2', title: 'Apple' }),
      makeSong({ id: '3', title: 'cherry' }),
    ];
    const sorted = sortLibrarySongs(songs, 'alphabet');

    expect(sorted.map(song => song.id)).toEqual(['2', '1', '3']);
    expect(songs.map(song => song.id)).toEqual(['1', '2', '3']);
  });

  test('sorts by leading track number with missing values last', () => {
    const songs = [
      makeSong({ id: 'a', title: 'A', trackNumber: '10' }),
      makeSong({ id: 'b', title: 'B', trackNumber: '2/12' }),
      makeSong({ id: 'c', title: 'C' }),
      makeSong({ id: 'd', title: 'D', trackNumber: '1' }),
    ];
    expect(sortLibrarySongs(songs, 'trackNumber').map(song => song.id)).toEqual(['d', 'b', 'a', 'c']);
  });

  test('sorts by year ascending with missing values last', () => {
    const songs = [
      makeSong({ id: 'a', title: 'A', year: '2001' }),
      makeSong({ id: 'b', title: 'B' }),
      makeSong({ id: 'c', title: 'C', year: '1998' }),
    ];
    expect(sortLibrarySongs(songs, 'year').map(song => song.id)).toEqual(['c', 'a', 'b']);
  });
});
