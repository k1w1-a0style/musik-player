import SystemAudio from 'expo-system-audio';
import { enrichMediaLibraryAssets, importSongsFromSources } from '../mediaLibraryImport';
import { cacheBase64Cover, cacheLocalCoverFile } from '../coverCache';
import { parseId3FromUri } from '../id3Parser';
import { StorageAccessFramework } from 'expo-file-system/legacy';

jest.mock('../coverCache', () => ({
  cacheBase64Cover: jest.fn(async () => undefined),
  cacheLocalCoverFile: jest.fn(async () => 'file:///documents/permanent.jpg'),
  isBase64ImageDataUri: jest.fn(() => false),
}));
jest.mock('../id3Parser', () => ({ parseId3FromUri: jest.fn(async () => ({})) }));
jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(async () => ({ exists: true, size: 123, md5: 'stable-hash' })),
  StorageAccessFramework: { readDirectoryAsync: jest.fn(async () => []) },
}));

const original = SystemAudio.extractImportSnapshot;
const read = jest.fn();
const artwork = { uri: 'file:///cache/staging.jpg', mimeType: 'image/jpeg', leaseId: 'snapshot-lease' };
const asset = { id: 'one', uri: 'content://music/one.mp3', filename: 'Mix.mp3', duration: 0,
  mediaType: 'audio' as const, width: 0, height: 0, creationTime: 0, modificationTime: 0 };
const snapshot = { audioInfo: { durationMs: 240_000, sampleRateHz: 44_100 }, artwork: { checked: true, artwork } };
beforeEach(() => {
  jest.clearAllMocks();
  SystemAudio.extractImportSnapshot = read;
  read.mockReset().mockResolvedValue(snapshot);
});
afterEach(() => {
  SystemAudio.extractImportSnapshot = original;
  jest.useRealTimers();
});

test('media import uses one combined request and copies before releasing the receipt', async () => {
  const result = await enrichMediaLibraryAssets([asset]);
  expect(read).toHaveBeenCalledTimes(1);
  expect(read).toHaveBeenCalledWith(asset.uri, true);
  expect(SystemAudio.extractAudioInfo).not.toHaveBeenCalled();
  expect(SystemAudio.extractEmbeddedArtwork).not.toHaveBeenCalled();
  expect(cacheLocalCoverFile).toHaveBeenCalledWith('one', artwork.uri, undefined);
  expect(result.songs[0]).toMatchObject({ duration: 240_000, audioInfo: { sampleRate: 44_100 },
    cover: 'file:///documents/permanent.jpg', coverInfo: { embeddedArtworkChecked: true } });
  expect(SystemAudio.releaseEmbeddedArtworkLease).toHaveBeenCalledTimes(1);
  expect((cacheLocalCoverFile as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
    (SystemAudio.releaseEmbeddedArtworkLease as jest.Mock).mock.invocationCallOrder[0]);
});

test('SAF uses the same snapshot path', async () => {
  (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockResolvedValue([asset.uri]);
  const result = await importSongsFromSources({ platformOs: 'android',
    scanFolders: [{ id: 'folder', name: 'Music', uri: 'content://music', enabled: true, addedAt: 1 }] });
  expect(result.songs[0]).toMatchObject({ duration: 240_000, cover: 'file:///documents/permanent.jpg' });
  expect(read).toHaveBeenCalledTimes(1);
  expect(SystemAudio.extractAudioInfo).not.toHaveBeenCalled();
  expect(SystemAudio.releaseEmbeddedArtworkLease).toHaveBeenCalledTimes(1);
});

test('disabled covers request only audio and never prove absence', async () => {
  read.mockResolvedValue({ ...snapshot, artwork: { checked: false, artwork: null } });
  const result = await enrichMediaLibraryAssets([asset], 0, { loadNativeCover: false });
  expect(read).toHaveBeenCalledWith(asset.uri, false);
  expect(cacheLocalCoverFile).not.toHaveBeenCalled();
  expect(result.songs[0]).toMatchObject({ duration: 240_000, coverInfo: { embeddedArtworkChecked: false } });
});

test('a parsed cover avoids native artwork work', async () => {
  (parseId3FromUri as jest.Mock).mockResolvedValueOnce({ cover: 'data:image/jpeg;base64,AAAA' });
  (cacheBase64Cover as jest.Mock).mockResolvedValueOnce('file:///documents/parsed.jpg');
  read.mockResolvedValue({ ...snapshot, artwork: { checked: false, artwork: null } });
  const result = await enrichMediaLibraryAssets([asset]);
  expect(read).toHaveBeenCalledWith(asset.uri, false);
  expect(result.songs[0].cover).toBe('file:///documents/parsed.jpg');
  expect(cacheLocalCoverFile).not.toHaveBeenCalled();
});

test('failed optional inspection remains unchecked without a second native read', async () => {
  read.mockResolvedValue({ ...snapshot, artwork: { checked: false, artwork: null } });
  const result = await enrichMediaLibraryAssets([asset]);
  expect(result.songs[0].coverInfo?.embeddedArtworkChecked).toBe(false);
  expect(SystemAudio.extractEmbeddedArtwork).not.toHaveBeenCalled();
});

test('a failed permanent copy releases exactly once and does not retain staging', async () => {
  (cacheLocalCoverFile as jest.Mock).mockResolvedValueOnce(undefined);
  const result = await enrichMediaLibraryAssets([asset]);
  expect(result.songs[0].cover).toBeUndefined();
  expect(result.songs[0].coverInfo?.embeddedArtworkChecked).toBe(false);
  expect(SystemAudio.releaseEmbeddedArtworkLease).toHaveBeenCalledTimes(1);
});

test('cancellation after the shared read releases the receipt before any copy', async () => {
  const controller = new AbortController();
  read.mockImplementation(async () => { controller.abort(); return snapshot; });
  await expect(enrichMediaLibraryAssets([asset], 0, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  expect(cacheLocalCoverFile).not.toHaveBeenCalled();
  expect(SystemAudio.releaseEmbeddedArtworkLease).toHaveBeenCalledTimes(1);
});

test('a receipt after the per-file deadline is released without copying or publishing', async () => {
  jest.useFakeTimers();
  let complete!: (value: typeof snapshot) => void;
  read.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  const pending = enrichMediaLibraryAssets([asset], 0, { perFileTimeoutMs: 10 });
  await jest.advanceTimersByTimeAsync(10);
  await expect(pending).resolves.toMatchObject({ songs: [] });
  complete(snapshot);
  await jest.advanceTimersByTimeAsync(0);
  expect(cacheLocalCoverFile).not.toHaveBeenCalled();
  expect(SystemAudio.releaseEmbeddedArtworkLease).toHaveBeenCalledTimes(1);
});
