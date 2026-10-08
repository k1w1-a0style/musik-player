import { getInfoAsync, StorageAccessFramework } from 'expo-file-system/legacy';
import SystemAudio from 'expo-system-audio';
import { parseId3FromUri } from '../id3Parser';
import { enrichMediaLibraryAssets, resetSafTimedOutUrisForTests, scanFromSafFolders } from '../mediaLibraryImport';
import { resetImportFileReadsForTests } from '../libraryImportBudget';

jest.mock('expo-file-system/legacy', () => ({ getInfoAsync: jest.fn(), StorageAccessFramework: { readDirectoryAsync: jest.fn() } }));
jest.mock('../id3Parser', () => ({ parseId3FromUri: jest.fn(async () => ({})) }));
jest.mock('../coverCache', () => ({ cacheBase64Cover: jest.fn(), cacheLocalCoverFile: jest.fn(), isBase64ImageDataUri: () => false }));

const uri = (name: string) => `content://music/${name}.mp3`;
const song = (name: string, dated = true) => ({ id: name, title: name, artist: 'Artist', uri: uri(name),
  fileInfo: { size: 1000, ...(dated ? { modificationTime: 100 } : {}), importedAt: 200, contentHash: 'old' } });
const folder = { id: 'music', name: 'Music', uri: 'content://music', enabled: true, addedAt: 1 };
const names = ['new', 'changed', 'same', 'unknown', 'hung'];
const existingSongs = [song('changed'), song('same'), song('unknown', false)];

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  resetImportFileReadsForTests();
  resetSafTimedOutUrisForTests();
  (SystemAudio.readImportFileStat as jest.Mock).mockImplementation(async (source: string) => ({ size: 1000,
    modificationTime: source === uri('unknown') ? undefined : source === uri('changed') ? 101 : 100 }));
  (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockResolvedValue(names.map(uri));
  (SystemAudio.extractAudioInfo as jest.Mock).mockResolvedValue(null);
  (getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 1000, md5: 'old' });
  (parseId3FromUri as jest.Mock).mockResolvedValue({});
});
afterEach(() => { jest.useRealTimers(); resetImportFileReadsForTests(); resetSafTimedOutUrisForTests(); });

test.each(['saf', 'media'] as const)('%s quick scan reports actual outcomes and finishes a timed-out file before its native reader settles', async source => {
  let release = (_tags: object): void => undefined;
  const hung = new Promise<object>(resolve => { release = resolve; });
  (parseId3FromUri as jest.Mock).mockImplementation((value: string) => value === uri('hung') ? hung : Promise.resolve({}));
  const progress = jest.fn();
  const options = { existingSongs, perFileTimeoutMs: 50, loadNativeCover: false, onFileProgress: progress };
  const scanning = source === 'saf' ? scanFromSafFolders([folder], options)
    : enrichMediaLibraryAssets(names.map(name => ({ id: name, uri: uri(name), filename: `${name}.mp3`, duration: 120 })) as any, 0, options);
  await jest.advanceTimersByTimeAsync(100);
  const result = await scanning;
  const statistics = { newCount: 1, changedCount: 1, unchangedCount: 1, unverifiedCount: 1, duplicateCount: 0, errorCount: 1 };
  expect(result).toMatchObject({ statistics, completed: false, remainingCount: 0 });
  expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ processed: 5, total: 5, currentTitle: '', statistics }));
  expect(getInfoAsync).not.toHaveBeenCalled();
  expect(parseId3FromUri).toHaveBeenCalledTimes(3);
  const publicationCount = progress.mock.calls.length;
  release({ title: 'Too late' });
  await jest.advanceTimersByTimeAsync(0);
  expect(progress).toHaveBeenCalledTimes(publicationCount);
  expect(result.songs).toHaveLength(2);
});

test('full scan compares content rather than counting every refreshed title as changed', async () => {
  const files = ['new', 'changed', 'same', 'unknown'];
  (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockResolvedValue(files.map(uri));
  (getInfoAsync as jest.Mock).mockImplementation(async (value: string) => ({ exists: true, size: 1000,
    md5: value === uri('changed') ? 'changed-hash' : value === uri('unknown') ? undefined : 'old' }));
  const scanning = scanFromSafFolders([folder], { existingSongs, refreshExisting: true, loadNativeCover: false });
  await jest.advanceTimersByTimeAsync(100);
  const result = await scanning;
  expect(result.songs).toHaveLength(4);
  expect(result).toMatchObject({ statistics: { newCount: 1, changedCount: 1, unchangedCount: 1, unverifiedCount: 1, errorCount: 0 } });
  expect(getInfoAsync).toHaveBeenCalledTimes(4);
});

test('overlapping tree grants cannot inflate new or unchanged counts', async () => {
  const base = 'content://provider';
  const a = `${base}/tree/Music/document/Music%2Fsame.mp3`;
  const alias = `${base}/tree/Root/document/Music%2Fsame.mp3`;
  (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockImplementation(async (value: string) => value === folder.uri ? [a] : [alias]);
  const previous = { ...song('same'), uri: a };
  const scanning = scanFromSafFolders([folder, { ...folder, id: 'alias', uri: 'content://alias' }], { existingSongs: [previous] });
  await jest.advanceTimersByTimeAsync(100);
  expect(await scanning).toMatchObject({ songs: [], statistics: { newCount: 0, unchangedCount: 1, duplicateCount: 1, unverifiedCount: 0 } });
  expect(parseId3FromUri).not.toHaveBeenCalled();
});

test('a full scan without content verification never calls a known same-size file unchanged', async () => {
  (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockResolvedValue([uri('same'), uri('new')]);
  (getInfoAsync as jest.Mock).mockRejectedValue(new Error('Provider cannot open full stream'));
  const scanning = scanFromSafFolders([folder], { existingSongs, refreshExisting: true, loadNativeCover: false });
  await jest.advanceTimersByTimeAsync(100);
  expect(await scanning).toMatchObject({ statistics: { newCount: 1, changedCount: 0, unchangedCount: 0, unverifiedCount: 2 } });
});

test('directory failure is visible even when no audio file could be discovered', async () => {
  (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockRejectedValue(new Error('Access revoked'));
  const progress = jest.fn();
  const scanning = scanFromSafFolders([folder], { onFileProgress: progress });
  await jest.advanceTimersByTimeAsync(100);
  expect(await scanning).toMatchObject({ songs: [], completed: false, statistics: { errorCount: 1, newCount: 0 } });
  expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ processed: 0, total: 0, statistics: expect.objectContaining({ errorCount: 1 }) }));
});
