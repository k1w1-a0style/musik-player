import { DEMO_SONGS, getLibraryDisplaySongs, isDemoSong, shouldUseDemoSongs } from '../libraryDemoSongs';
import type { Song } from '../../types/Song';

const realSong: Song = { id: 'real-1', title: 'Real', artist: 'Artist', album: 'Album', uri: 'file:///music/real.mp3' };

test('detects demo songs by id prefix', () => {
  expect(isDemoSong(DEMO_SONGS[0])).toBe(true);
  expect(isDemoSong(realSong)).toBe(false);
});

test('uses demo songs only in dev with ready empty library', () => {
  expect(shouldUseDemoSongs(true, 'development', true, 0)).toBe(true);
  expect(shouldUseDemoSongs(true, 'test', true, 0)).toBe(false);
  expect(shouldUseDemoSongs(false, 'development', true, 0)).toBe(false);
  expect(shouldUseDemoSongs(true, 'development', false, 0)).toBe(false);
  expect(shouldUseDemoSongs(true, 'development', true, 1)).toBe(false);
});

test('returns demo songs for empty dev library', () => {
  expect(getLibraryDisplaySongs([], true, true, 'development')).toBe(DEMO_SONGS);
});

test('returns real songs when demo mode is disabled', () => {
  expect(getLibraryDisplaySongs([realSong], true, true, 'development')).toEqual([realSong]);
  expect(getLibraryDisplaySongs([], true, true, 'test')).toEqual([]);
});
