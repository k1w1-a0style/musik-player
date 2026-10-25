import type { ImportSnapshot } from '../../modules/expo-system-audio';

const folder = { id: 'music', name: 'Music', uri: 'content://provider/tree/music', enabled: true, addedAt: 1 };
const files = Array.from({ length: 6 }, (_, index) => `content://provider/document/music%2F${index}.mp3`);
const snapshot: ImportSnapshot = { audioInfo: { durationMs: 65_000 }, artwork: { checked: true, artwork: null } };

const loadImporter = (nativeRead: jest.Mock, nativeStat = jest.fn(async () => ({ size: 1000, modificationTime: 100 })), extra: Record<string, unknown> = {}) => {
  jest.resetModules();
  jest.doMock('expo', () => ({ NativeModule: class {}, requireNativeModule: () => ({
    extractImportSnapshot: nativeRead, readImportFileStat: nativeStat,
    releaseEmbeddedArtworkLease: jest.fn(async () => true), ...extra,
  }) }));
  jest.doMock('expo-system-audio', () => jest.requireActual('../../modules/expo-system-audio/index'));
  jest.doMock('expo-media-library/legacy', () => ({}));
  jest.doMock('../id3Parser', () => ({ parseId3FromUri: jest.fn(async () => ({ title: 'Readable ID3 title' })) }));
  jest.doMock('../coverCache', () => ({ cacheBase64Cover: jest.fn(), cacheLocalCoverFile: jest.fn(), isBase64ImageDataUri: () => false }));
  jest.doMock('expo-file-system/legacy', () => ({ StorageAccessFramework: { readDirectoryAsync: jest.fn(async () => files) } }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- The real facade is loaded after the isolated native boundary.
  return require('../mediaLibraryImport') as typeof import('../mediaLibraryImport');
};
afterEach(() => { jest.useRealTimers(); jest.resetModules(); jest.dontMock('expo'); });

test('two permanently blocked native snapshots leave the uninspected tail pending through the real facade', async () => {
  jest.useFakeTimers();
  const nativeRead = jest.fn(() => new Promise<ImportSnapshot>(() => undefined));
  const { scanFromSafFolders } = loadImporter(nativeRead);
  const checkpoint = jest.fn();
  const task = scanFromSafFolders([folder], { onCheckpoint: checkpoint });
  await jest.advanceTimersByTimeAsync(35_000);
  const result = await task;
  expect(nativeRead).toHaveBeenCalledTimes(2);
  expect(result.songs).toEqual([]);
  expect(checkpoint).not.toHaveBeenCalled();
  expect(result).toMatchObject({ completed: false, remainingCount: 4 });
  expect(result.errors).toHaveLength(2);
});

test('late raw settlement resumes the healthy tail in the same scan without synthetic snapshots', async () => {
  jest.useFakeTimers();
  let active = 0; let peak = 0;
  const nativeRead = jest.fn(async (uri: string) => {
    active++; peak = Math.max(peak, active);
    try {
      if (files.slice(0, 2).includes(uri)) await new Promise(resolve => setTimeout(resolve, 22_000));
      return snapshot;
    } finally { active--; }
  });
  const { scanFromSafFolders } = loadImporter(nativeRead);
  const checkpoint = jest.fn();
  const task = scanFromSafFolders([folder], { onCheckpoint: checkpoint });
  await jest.advanceTimersByTimeAsync(35_000);
  const result = await task;
  expect(nativeRead).toHaveBeenCalledTimes(6);
  expect(peak).toBe(2);
  expect(result.songs).toHaveLength(4);
  expect(result.songs.every(song => song.duration === 65_000)).toBe(true);
  expect(checkpoint.mock.calls.flatMap(([batch]) => batch.songs)).toHaveLength(4);
  expect(result).toMatchObject({ completed: false, remainingCount: 0 });
});


test('two blocked native stats do not turn into unknown revisions and successful imports', async () => {
  jest.useFakeTimers();
  const nativeRead = jest.fn(async () => snapshot);
  const nativeStat = jest.fn(() => new Promise<{ size: number; modificationTime: number }>(() => undefined));
  const { scanFromSafFolders } = loadImporter(nativeRead, nativeStat);
  const checkpoint = jest.fn();
  const task = scanFromSafFolders([folder], { onCheckpoint: checkpoint });
  await jest.advanceTimersByTimeAsync(35_000);
  const result = await task;
  expect(nativeStat).toHaveBeenCalledTimes(2);
  expect(nativeRead).not.toHaveBeenCalled();
  expect(checkpoint).not.toHaveBeenCalled();
  expect(result).toMatchObject({ songs: [], completed: false, remainingCount: 4 });
});


test('a preoccupied general media pool resumes real import reads after its actual release', async () => {
  jest.useFakeTimers();
  const releases: Array<() => void> = [];
  const background = jest.fn(() => new Promise<null>(resolve => { releases.push(() => resolve(null)); }));
  const nativeRead = jest.fn(async () => snapshot);
  const { scanFromSafFolders } = loadImporter(nativeRead, undefined, { extractAudioInfo: background });
  const audio = jest.requireActual<typeof import('../../modules/expo-system-audio')>('../../modules/expo-system-audio').SystemAudio;
  const older = [audio.extractAudioInfo('content://background/one'), audio.extractAudioInfo('content://background/two')];
  await jest.advanceTimersByTimeAsync(0);
  const task = scanFromSafFolders([folder]);
  await jest.advanceTimersByTimeAsync(5000);
  expect(nativeRead).not.toHaveBeenCalled();
  releases.forEach(release => release());
  await jest.advanceTimersByTimeAsync(1000); await Promise.all(older);
  const result = await task;
  expect(nativeRead).toHaveBeenCalledTimes(6);
  expect(result.songs).toHaveLength(6);
  expect(result.songs.every(song => song.duration === 65_000)).toBe(true);
});

test('cancelling while a real media pool is occupied never dispatches an import after capacity returns', async () => {
  jest.useFakeTimers();
  const releases: Array<() => void> = [];
  const background = jest.fn(() => new Promise<null>(resolve => { releases.push(() => resolve(null)); }));
  const nativeRead = jest.fn(async () => snapshot);
  const { scanFromSafFolders } = loadImporter(nativeRead, undefined, { extractAudioInfo: background });
  const audio = jest.requireActual<typeof import('../../modules/expo-system-audio')>('../../modules/expo-system-audio').SystemAudio;
  const older = [audio.extractAudioInfo('content://background/one'), audio.extractAudioInfo('content://background/two')];
  await jest.advanceTimersByTimeAsync(0);
  const controller = new AbortController();
  const task = scanFromSafFolders([folder], { signal: controller.signal });
  const cancelled = expect(task).rejects.toMatchObject({ name: 'AbortError' });
  await jest.advanceTimersByTimeAsync(1000);
  controller.abort(); await cancelled;
  releases.forEach(release => release());
  await jest.advanceTimersByTimeAsync(1000); await Promise.all(older);
  expect(nativeRead).not.toHaveBeenCalled();
});

test('late real snapshot leases are released once after a scan cancellation', async () => {
  jest.useFakeTimers();
  const releases: Array<(value: ImportSnapshot) => void> = [];
  const nativeRead = jest.fn(() => new Promise<ImportSnapshot>(resolve => { releases.push(resolve); }));
  const releaseLease = jest.fn(async () => true);
  const { scanFromSafFolders } = loadImporter(nativeRead, undefined, { releaseEmbeddedArtworkLease: releaseLease });
  const controller = new AbortController(); const checkpoint = jest.fn();
  const task = scanFromSafFolders([folder], { signal: controller.signal, onCheckpoint: checkpoint });
  const cancelled = expect(task).rejects.toMatchObject({ name: 'AbortError' });
  await jest.advanceTimersByTimeAsync(1000);
  expect(nativeRead).toHaveBeenCalledTimes(2);
  controller.abort(); await cancelled;
  releases.forEach((release, index) => release({ ...snapshot, artwork: { checked: true,
    artwork: { uri: 'file:///cache/late.jpg', mimeType: 'image/jpeg', leaseId: `late-${index}` } } }));
  await jest.advanceTimersByTimeAsync(1000);
  expect(releaseLease.mock.calls).toEqual([['late-0'], ['late-1']]);
  expect(checkpoint).not.toHaveBeenCalled();
});

test('an incremental scan repairs known unchecked placeholder songs without changing their identities', async () => {
  jest.useFakeTimers();
  const nativeRead = jest.fn(async () => snapshot);
  const { scanFromSafFolders } = loadImporter(nativeRead);
  const existing = files.map((uri, index) => ({ id: `kept-${index}`, title: 'Existing title', artist: 'Artist', uri,
    fileInfo: { uri, size: 1000, modificationTime: 100, importedAt: 200 },
    coverInfo: { status: 'none' as const, embeddedArtworkChecked: false } }));
  const task = scanFromSafFolders([folder], { existingSongs: existing });
  await jest.advanceTimersByTimeAsync(2000);
  const result = await task;
  expect(nativeRead).toHaveBeenCalledTimes(6);
  expect(result.songs).toHaveLength(6);
  expect(result.songs.every(song => song.duration === 65_000)).toBe(true);
  expect(result.songs.map(song => song.id).sort()).toEqual(existing.map(song => song.id).sort());
  expect(result.statistics).toMatchObject({ newCount: 0, changedCount: 0, unchangedCount: 6 });
});
