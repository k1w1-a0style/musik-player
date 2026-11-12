import SystemAudio from 'expo-system-audio';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { parseId3FromUri } from '../id3Parser';
import { importSongsFromSources } from '../mediaLibraryImport';
import { resetImportFileReadsForTests } from '../libraryImportBudget';

jest.mock('expo-file-system/legacy', () => ({ StorageAccessFramework: { readDirectoryAsync: jest.fn() } }));
jest.mock('../id3Parser', () => ({ parseId3FromUri: jest.fn() }));
jest.mock('../coverCache', () => ({ cacheBase64Cover: jest.fn(async () => undefined), cacheLocalCoverFile: jest.fn(), isBase64ImageDataUri: () => false }));
const folder = { id: 'music', name: 'Music', uri: 'content://test/tree/music', enabled: true, addedAt: 1 };
const files = Array.from({ length: 16 }, (_, i) => `content://test/document/music%2F${i}.mp3`);
const stat = SystemAudio.readImportFileStat;
const snapshot = SystemAudio.extractImportSnapshot;
beforeEach(() => { jest.useFakeTimers(); resetImportFileReadsForTests(); jest.clearAllMocks();
  (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockResolvedValue(files);
  SystemAudio.readImportFileStat = jest.fn(async () => ({ size: 100, modificationTime: 20 }));
});
afterEach(() => { SystemAudio.readImportFileStat = stat; SystemAudio.extractImportSnapshot = snapshot;
  resetImportFileReadsForTests(); jest.useRealTimers(); });

test('imports sixteen playable records once without requesting either blocked cover operation', async () => {
  const blocked = new Set(files.slice(0, 2));
  (parseId3FromUri as jest.Mock).mockImplementation((uri: string, options: { includeCover?: boolean }) =>
    blocked.has(uri) && options.includeCover !== false ? new Promise(() => undefined) : Promise.resolve({ title: uri }));
  SystemAudio.extractImportSnapshot = jest.fn((uri, _includeArtwork) =>
    blocked.has(uri) ? new Promise(() => undefined) : Promise.resolve({ audioInfo: { durationMs: 60_000 }, artwork: { checked: false, artwork: null } }));
  const checkpoints = jest.fn();
  const pending = importSongsFromSources({ scanFolders: [folder], platformOs: 'android', loadNativeCovers: false,
    perFileTimeoutMs: 50, onCheckpoint: checkpoints });
  await jest.advanceTimersByTimeAsync(500);
  const result = await pending;
  expect(result.songs).toHaveLength(16);
  expect(result.songs.every(song => song.uri && song.coverInfo?.embeddedArtworkChecked === false)).toBe(true);
  expect(result.errors).toEqual([]);
  expect(result.completed).not.toBe(false);
  expect(checkpoints.mock.calls.flatMap(([batch]) => batch.songs)).toHaveLength(16);
  expect(SystemAudio.extractImportSnapshot).not.toHaveBeenCalled();
  expect((parseId3FromUri as jest.Mock).mock.calls.every(([, options]) => options.includeCover === false)).toBe(true);
});
