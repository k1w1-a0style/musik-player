import SystemAudio from 'expo-system-audio';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { enrichMediaLibraryAssets, resetSafTimedOutUrisForTests, scanFromSafFolders } from '../mediaLibraryImport';
import { resetImportFileReadsForTests } from '../libraryImportBudget';
import { parseId3FromUri } from '../id3Parser';
import { createQuickScanYieldBudget } from '../libraryImportYield';

jest.mock('expo-file-system/legacy', () => ({ StorageAccessFramework: { readDirectoryAsync: jest.fn() } }));
jest.mock('../id3Parser', () => ({ parseId3FromUri: jest.fn() }));
jest.mock('../coverCache', () => ({ cacheBase64Cover: jest.fn(), cacheLocalCoverFile: jest.fn(), isBase64ImageDataUri: () => false }));
const songs = Array.from({ length: 128 }, (_, index) => ({ id: `s-${index}`, title: `Track ${index}`, artist: 'Artist',
  uri: `content://music/track-${index}.mp3`, fileInfo: { size: 1000, modificationTime: 100, importedAt: 200 } }));
const folder = { id: 'folder', name: 'Music', uri: 'content://music', enabled: true, addedAt: 1 };
const start = (source: 'saf' | 'media', signal?: AbortSignal, progress?: jest.Mock) => source === 'saf'
  ? scanFromSafFolders([folder], { existingSongs: songs, signal, onFileProgress: progress })
  : enrichMediaLibraryAssets(songs.map(song => ({ id: song.id, uri: song.uri,
    filename: song.title, duration: 120 })) as never, 0, { existingSongs: songs, signal, onFileProgress: progress });

beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); resetImportFileReadsForTests(); resetSafTimedOutUrisForTests();
  (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockResolvedValue(songs.map(song => song.uri));
  (SystemAudio.readImportFileStat as jest.Mock).mockResolvedValue({ size: 1000, modificationTime: 100 });
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); resetImportFileReadsForTests(); resetSafTimedOutUrisForTests(); });

test.each(['saf', 'media'] as const)('%s quick scan yields in bounded batches rather than once per reused title', async source => {
  const timer = jest.spyOn(global, 'setTimeout');
  const scanning = start(source);
  await jest.runAllTimersAsync();
  expect(await scanning).toMatchObject({ songs: [], reusedCount: 128, statistics: { unchangedCount: 128 } });
  const frameYields = timer.mock.calls.filter(([, delay]) => delay === 0).length;
  expect(frameYields).toBeGreaterThanOrEqual(8);
  expect(frameYields).toBeLessThan(32);
  expect(parseId3FromUri).not.toHaveBeenCalled();
});

test.each(['saf', 'media'] as const)('%s remains cancellable at a frame yield without late progress or metadata reads', async source => {
  const controller = new AbortController(); const progress = jest.fn();
  const schedule = global.setTimeout;
  jest.spyOn(global, 'setTimeout').mockImplementation(((callback: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => {
    if (delay === 0 && (SystemAudio.readImportFileStat as jest.Mock).mock.calls.length >= 16) controller.abort();
    return schedule(callback, delay, ...args);
  }) as never);
  const scanning = start(source, controller.signal, progress).catch(error => error);
  // The timer wrapper aborts the public scan at its first file frame boundary.
  await jest.runAllTimersAsync();
  const outcome = await scanning;
  expect(outcome).toMatchObject({ name: 'AbortError' });
  const publications = progress.mock.calls.length;
  await Promise.resolve(); await Promise.resolve();
  expect(progress).toHaveBeenCalledTimes(publications);
  expect(parseId3FromUri).not.toHaveBeenCalled();
});

test('keeps provider stat concurrency at two while a large quick scan drains', async () => {
  let active = 0; let maximum = 0;
  (SystemAudio.readImportFileStat as jest.Mock).mockImplementation(async () => {
    active += 1; maximum = Math.max(maximum, active);
    await Promise.resolve(); active -= 1;
    return { size: 1000, modificationTime: 100 };
  });
  const scanning = start('saf'); await jest.runAllTimersAsync(); await scanning;
  expect(maximum).toBe(2); expect(active).toBe(0);
});

test('the elapsed work budget yields after eight milliseconds even below the record limit', async () => {
  const timer = jest.spyOn(global, 'setTimeout');
  const budget = createQuickScanYieldBudget();
  await budget();
  jest.setSystemTime(Date.now() + 8);
  const frame = budget();
  expect(timer.mock.calls.filter(([, delay]) => delay === 0)).toHaveLength(1);
  await jest.advanceTimersByTimeAsync(0); await frame;
});

test('concurrent workers share one pending frame and cancellation clears both waiters after that frame', async () => {
  const budget = createQuickScanYieldBudget(); const controller = new AbortController();
  for (let index = 0; index < 15; index++) await budget(controller.signal);
  const first = budget(controller.signal).catch(error => error);
  const second = budget(controller.signal).catch(error => error);
  expect(jest.getTimerCount()).toBe(1);
  controller.abort(); await jest.advanceTimersByTimeAsync(0);
  expect(await first).toMatchObject({ name: 'AbortError' });
  expect(await second).toMatchObject({ name: 'AbortError' });
  expect(jest.getTimerCount()).toBe(0);
});

test.each(['saf', 'media'] as const)('%s retains each source revision update across another worker at a shared frame', async source => {
  const existing = songs.map((song, index) => index === 16 ? { ...song,
    fileInfo: { ...song.fileInfo, modificationTime: 1_700_000_000 } } : song);
  (SystemAudio.readImportFileStat as jest.Mock).mockImplementation(async (uri: string) => ({ size: 1000,
    modificationTime: uri === songs[16].uri ? 1_700_000_000_000 : 100 }));
  const checkpoint = jest.fn();
  const options = { existingSongs: existing, onCheckpoint: checkpoint };
  const scanning = source === 'saf' ? scanFromSafFolders([folder], options)
    : enrichMediaLibraryAssets(existing.map(song => ({ id: song.id, uri: song.uri,
      filename: song.title, duration: 120 })) as never, 0, options);
  await jest.runAllTimersAsync();
  expect(await scanning).toMatchObject({ reusedCount: 128, revisionUpdates: [{ id: songs[16].id }] });
  const storedUpdates = checkpoint.mock.calls.flatMap(([snapshot]) => snapshot.songs);
  expect(storedUpdates.map(song => song.id)).toEqual([songs[16].id]);
});
