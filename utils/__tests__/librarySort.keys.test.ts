import type { Song } from '../../types/Song';
import * as presentation from '../libraryPresentation';
import { sortLibrarySongs } from '../librarySort';

const collection = (count: number): Song[] => Array.from({ length: count }, (_, index) => ({
  id: `sort-${index}`, title: `Änderung ${(index * 7919) % count}`, artist: `Künstler ${index % 37}`,
  uri: `file:///sort-${index}.mp3`, year: String(1950 + index % 76),
  trackNumber: `${index % 20 + 1}/20`, discNumber: String(index % 3 + 1),
  fileInfo: { importedAt: index * 1000 },
}));

afterEach(() => jest.restoreAllMocks());

test.each([500, 2000, 5000])('reuses presentation keys on a warm %i-title sort', count => {
  const songs = collection(count);
  const title = jest.spyOn(presentation, 'displayTitle');
  const locale = jest.spyOn(String.prototype, 'localeCompare');
  const before = performance.now();
  const first = sortLibrarySongs(songs, 'alphabet');
  const coldMs = performance.now() - before;
  const coldTitleCalls = title.mock.calls.length;
  const coldLocaleCalls = locale.mock.calls.length;
  title.mockClear(); locale.mockClear();
  const warmStart = performance.now();
  const second = sortLibrarySongs(songs, 'alphabet');
  const warmMs = performance.now() - warmStart;
  const warmTitleCalls = title.mock.calls.length;
  const warmLocaleCalls = locale.mock.calls.length;
  // eslint-disable-next-line no-console -- Aggregate reproducible host timings and counters; no device-performance claim.
  console.info(JSON.stringify({ scope: 'host JavaScript seeded collection; real collation; one cold and one warm sort',
    songs: count, coldMs, warmMs, coldTitleCalls, warmTitleCalls, coldLocaleCalls, warmLocaleCalls }));
  expect(second).toEqual(first);
  expect(coldTitleCalls).toBe(count);
  expect(warmTitleCalls).toBe(0);
  expect(coldLocaleCalls).toBe(0);
  expect(warmLocaleCalls).toBe(0);
}, 30000);

test('replaces cached keys when immutable metadata changes without touching unchanged sources', () => {
  const songs = collection(3);
  sortLibrarySongs(songs, 'alphabet');
  const title = jest.spyOn(presentation, 'displayTitle');
  const changed = { ...songs[1], title: 'AAA', year: '1940', fileInfo: { importedAt: 999999 } };
  const revision = [songs[0], changed, songs[2]];
  expect(sortLibrarySongs(revision, 'alphabet')[0]).toBe(changed);
  expect(title).toHaveBeenCalledTimes(1);
  expect(sortLibrarySongs(revision, 'year')[0]).toBe(changed);
  expect(sortLibrarySongs(revision, 'recentlyAdded')[0]).toBe(changed);
  expect(title).toHaveBeenCalledTimes(1);
});
