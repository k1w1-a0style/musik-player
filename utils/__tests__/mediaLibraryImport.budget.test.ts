import { StorageAccessFramework } from 'expo-file-system/legacy';
import { parseId3FromUri } from '../id3Parser';
import { scanFromSafFolders, readAudioUrisFromSafDirectory, resetSafTimedOutUrisForTests, MAX_SAF_FILES } from '../mediaLibraryImport';
import { resetImportFileReadsForTests } from '../libraryImportBudget';

jest.mock('expo-file-system/legacy', () => ({ StorageAccessFramework: { readDirectoryAsync: jest.fn() } }));
jest.mock('expo-file-system', () => ({ File: jest.fn(() => ({ info: () => ({ exists: true, size: 1000, modificationTime: 100 }) })) }));
jest.mock('../id3Parser', () => ({ parseId3FromUri: jest.fn() }));
jest.mock('../coverCache', () => ({ cacheBase64Cover: jest.fn(async () => undefined), cacheLocalCoverFile: jest.fn(), isBase64ImageDataUri: () => false }));

const folder = { id: 'music', name: 'Music', uri: 'content://music', enabled: true, addedAt: 1 };
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  resetImportFileReadsForTests();
  resetSafTimedOutUrisForTests();
});
afterEach(() => { jest.useRealTimers(); resetImportFileReadsForTests(); resetSafTimedOutUrisForTests(); });

test('confirms healthy files while a hung reader retires, with no late song or checkpoint after its timeout', async () => {
  let releaseHung: (tags: { title: string }) => void = () => undefined;
  const hung = new Promise<{ title: string }>(resolve => { releaseHung = resolve; });
  const files = ['good', 'hung', 'later', 'last'].map(name => `content://music/${name}.mp3`);
  (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockResolvedValue(files);
  (parseId3FromUri as jest.Mock).mockImplementation((uri: string) => uri.includes('/hung.') ? hung : Promise.resolve({ title: uri }));
  const onCheckpoint = jest.fn();
  const result = scanFromSafFolders([folder], { perFileTimeoutMs: 50, onCheckpoint, loadNativeCover: false });
  await jest.advanceTimersByTimeAsync(15);
  expect(onCheckpoint).toHaveBeenCalled();
  expect(onCheckpoint.mock.calls.flatMap(([checkpoint]) => checkpoint.songs).every((song: { uri: string }) => !song.uri.includes('/hung.'))).toBe(true);
  await jest.advanceTimersByTimeAsync(50);
  const partial = await result;
  expect(partial).toMatchObject({ completed: false, remainingCount: 0, errors: [files[1]] });
  expect(partial.songs).toHaveLength(3);
  const confirmedCount = onCheckpoint.mock.calls.length;
  releaseHung({ title: 'Late result must not be accepted' });
  await jest.advanceTimersByTimeAsync(0);
  expect(partial.songs).toHaveLength(3);
  expect(onCheckpoint).toHaveBeenCalledTimes(confirmedCount);
  expect(partial.folderUpdates?.[0].lastError).toContain('Scan wiederholen');

  (parseId3FromUri as jest.Mock).mockClear();
  const retry = scanFromSafFolders([folder], { existingSongs: partial.songs, loadNativeCover: false });
  await jest.advanceTimersByTimeAsync(15);
  const recovered = await retry;
  expect(recovered.reusedCount).toBe(3);
  expect(recovered.songs).toHaveLength(1);
  expect(parseId3FromUri).toHaveBeenCalledTimes(1);
});

test('directory siblings use at most two provider reads and keep gathering healthy results', async () => {
  const releases = new Map<string, (entries: string[]) => void>();
  let active = 0;
  let maximum = 0;
  const read = jest.fn((uri: string) => {
    if (uri === folder.uri) return Promise.resolve(['a', 'b', 'c'].map(name => `${uri}/${name}`));
    active += 1;
    maximum = Math.max(maximum, active);
    return new Promise<string[]>(resolve => { releases.set(uri, entries => { active -= 1; resolve(entries); }); });
  });
  const result = readAudioUrisFromSafDirectory(folder.uri, read);
  await jest.advanceTimersByTimeAsync(10);
  expect(releases.size).toBe(2);
  releases.get('content://music/a')?.(['content://music/a/one.mp3']);
  await jest.advanceTimersByTimeAsync(10);
  expect(releases.size).toBe(3);
  releases.get('content://music/b')?.(['content://music/b/two.mp3']);
  releases.get('content://music/c')?.(['content://music/c/three.mp3']);
  await jest.advanceTimersByTimeAsync(10);
  expect(maximum).toBe(2);
  await expect(result).resolves.toMatchObject({ files: expect.arrayContaining([
    'content://music/a/one.mp3', 'content://music/b/two.mp3', 'content://music/c/three.mp3',
  ]), errors: [] });
});

test('a truncated SAF enumeration reports a diagnostic instead of complete success', async () => {
  const read = async () => Array.from({ length: MAX_SAF_FILES + 1 }, (_, index) => `${folder.uri}/${index}.mp3`);
  const result = readAudioUrisFromSafDirectory(folder.uri, read);
  await jest.advanceTimersByTimeAsync(500);
  await expect(result).resolves.toMatchObject({ errors: [folder.uri] });
  expect((await result).files).toHaveLength(MAX_SAF_FILES);
});
