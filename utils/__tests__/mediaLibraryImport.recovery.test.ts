import SystemAudio from 'expo-system-audio';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { parseId3FromUri } from '../id3Parser';
import { scanFromSafFolders } from '../mediaLibraryImport';
import { resetImportFileReadsForTests } from '../libraryImportBudget';

jest.mock('../coverCache', () => ({ cacheBase64Cover: jest.fn(async () => undefined),
  cacheLocalCoverFile: jest.fn(async () => undefined), isBase64ImageDataUri: () => false }));
jest.mock('../id3Parser', () => ({ parseId3FromUri: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({ StorageAccessFramework: { readDirectoryAsync: jest.fn() } }));

const folder = { id: 'music', name: 'Music', uri: 'content://test/tree/music', enabled: true, addedAt: 1 };
const files = Array.from({ length: 12 }, (_, i) => `content://test/document/music%2F${i}.mp3`);
const stat = SystemAudio.readImportFileStat;
const snapshot = SystemAudio.extractImportSnapshot;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
beforeEach(() => {
  jest.useFakeTimers(); resetImportFileReadsForTests(); jest.clearAllMocks();
  (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockResolvedValue(files);
});
afterEach(() => {
  SystemAudio.readImportFileStat = stat; SystemAudio.extractImportSnapshot = snapshot;
  resetImportFileReadsForTests(); jest.useRealTimers();
});

test('a single slow SAF scan confirms all twelve tracks progressively and reuses them on the next update', async () => {
  SystemAudio.readImportFileStat = jest.fn(async () => { await delay(6); return { size: 100, modificationTime: 20 }; });
  (parseId3FromUri as jest.Mock).mockImplementation(async () => { await delay(6); return { title: 'Verified title' }; });
  SystemAudio.extractImportSnapshot = jest.fn(async () => { await delay(6);
    return { audioInfo: { durationMs: 60_000 }, artwork: { checked: true, artwork: null } }; });
  const checkpoint = jest.fn();
  const pending = scanFromSafFolders([folder], { perFileTimeoutMs: 10, onCheckpoint: checkpoint });
  await jest.advanceTimersByTimeAsync(160);
  const result = await pending;
  expect(result.songs).toHaveLength(12); expect(result.errors).toEqual([]);
  expect(result.completed).not.toBe(false);
  expect(checkpoint.mock.calls[0][0].songs).toHaveLength(1);
  expect(checkpoint.mock.calls.flatMap(([batch]) => batch.songs)).toHaveLength(12);
  const calls = (SystemAudio.extractImportSnapshot as jest.Mock).mock.calls.length;
  const update = scanFromSafFolders([folder], { perFileTimeoutMs: 10, existingSongs: result.songs });
  await jest.advanceTimersByTimeAsync(120);
  const reused = await update;
  expect(reused.reusedCount).toBe(12); expect(reused.songs).toEqual([]);
  expect(SystemAudio.extractImportSnapshot).toHaveBeenCalledTimes(calls);
});

test('two late native reads retain reservations, report their phase and do not discard the healthy tail', async () => {
  SystemAudio.readImportFileStat = jest.fn(async () => ({ size: 100, modificationTime: 20 }));
  (parseId3FromUri as jest.Mock).mockResolvedValue({});
  let active = 0; let peak = 0;
  SystemAudio.extractImportSnapshot = jest.fn(async uri => {
    active++; peak = Math.max(peak, active);
    try { if (files.slice(0, 2).includes(uri)) await delay(12);
      return { audioInfo: { durationMs: 60_000 }, artwork: { checked: true, artwork: null } };
    } finally { active--; }
  });
  const pending = scanFromSafFolders([folder], { perFileTimeoutMs: 10 });
  await jest.advanceTimersByTimeAsync(100);
  const result = await pending;
  expect(result.songs).toHaveLength(10);
  expect(result).toMatchObject({ completed: false, remainingCount: 0 });
  expect(result.errors).toEqual(files.slice(0, 2).map(decodeURIComponent));
  expect(result.errorDetails).toEqual(expect.arrayContaining(files.slice(0, 2).map(uri =>
    expect.objectContaining({ uri: decodeURIComponent(uri), phase: 'audioInfo', code: 'timeout' }))));
  expect(peak).toBe(2); expect(jest.getTimerCount()).toBe(0);
});
