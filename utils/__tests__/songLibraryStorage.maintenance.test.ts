import AsyncStorage from '@react-native-async-storage/async-storage';
import { readStoredSongLibrary, removeStoredSongLibrary, resetSongLibraryStorageForTests,
  SONG_LIBRARY_CHUNK_PREFIX, SONG_LIBRARY_MANIFEST_KEY, writeStoredSongLibrary } from '../songLibraryStorage';
import { beginMetadataRefreshActivity, endMetadataRefreshActivity, resetMetadataRefreshActivityForTests } from '../metadataRefreshActivity';
import { blockPersistenceForMaintenance, flushPersistenceOwners, releasePersistenceMaintenance,
  waitForPersistenceWork } from '../persistenceMaintenance';
import { flushSongLibraryMaintenance } from '../songLibraryMaintenance';
import { resetWaveformExtractionLifecycleForTests, scheduleNativeWaveformExtraction } from '../waveformExtractionLifecycle';

const legacyKey = '@musikplayer:songs';
const snapshot = JSON.stringify([{ id: 'known', title: 'Known' }]);
const tick = async (): Promise<void> => { for (let index = 0; index < 30; index++) await Promise.resolve(); };
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; };
const value = (id: string) => JSON.stringify([{ id, title: id }]);
const currentChunk = async () => JSON.parse((await AsyncStorage.getItem(SONG_LIBRARY_MANIFEST_KEY))!).chunks[0].key as string;

beforeEach(() => {
  jest.useFakeTimers();
  jest.restoreAllMocks();
  (AsyncStorage as unknown as { __reset(): void }).__reset();
  resetSongLibraryStorageForTests();
  resetMetadataRefreshActivityForTests();
  releasePersistenceMaintenance();
  resetWaveformExtractionLifecycleForTests();
});
afterEach(() => { resetSongLibraryStorageForTests(); jest.useRealTimers(); jest.restoreAllMocks(); });

test.each(['removeItem', 'getAllKeys', 'multiRemove'] as const)(
  'a verified manifest acknowledges independently of optional %s settlement', async method => {
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    if (method === 'multiRemove') await AsyncStorage.setItem('@musikplayer:song-library:v2:chunk:orphan', 'orphan');
    const original = (AsyncStorage[method] as jest.Mock).getMockImplementation()!;
    jest.spyOn(AsyncStorage, method).mockImplementation((async (...args: unknown[]) => {
      await held;
      return (original as (...values: unknown[]) => Promise<unknown>)(...args);
    }) as never);
    let committed = false;
    const write = writeStoredSongLibrary(legacyKey, snapshot).then(() => { committed = true; });
    await tick();
    const beforeOptionalSettlement = committed;
    release();
    await write;
    expect(beforeOptionalSettlement).toBe(true);
    await expect(readStoredSongLibrary(legacyKey)).resolves.toEqual({ source: 'chunked', serialized: snapshot });
  },
);

test('coalesces commits for one second and bounds each deletion pass to 256 keys', async () => {
  await writeStoredSongLibrary(legacyKey, snapshot);
  await writeStoredSongLibrary(legacyKey, snapshot);
  await AsyncStorage.multiSet(Array.from({ length: 600 }, (_, index) => [`${SONG_LIBRARY_CHUNK_PREFIX}orphan-${index}`, 'orphan']));
  (AsyncStorage.getAllKeys as jest.Mock).mockClear();
  (AsyncStorage.multiRemove as jest.Mock).mockClear();
  await jest.advanceTimersByTimeAsync(999);
  expect(AsyncStorage.getAllKeys).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(1);
  expect(AsyncStorage.getAllKeys).toHaveBeenCalledTimes(1);
  const firstPass = (AsyncStorage.multiRemove as jest.Mock).mock.calls[0][0] as string[];
  expect(firstPass.length).toBeLessThanOrEqual(256);
  await flushSongLibraryMaintenance();
  expect((await AsyncStorage.getAllKeys()).filter(key => key.startsWith(SONG_LIBRARY_CHUNK_PREFIX))).toEqual([await currentChunk()]);
});

test('metadata refresh defers maintenance while committed snapshots remain immediately usable', async () => {
  beginMetadataRefreshActivity();
  await writeStoredSongLibrary(legacyKey, snapshot);
  (AsyncStorage.getAllKeys as jest.Mock).mockClear();
  await jest.advanceTimersByTimeAsync(3000);
  expect(AsyncStorage.getAllKeys).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(1);
  await expect(readStoredSongLibrary(legacyKey)).resolves.toEqual({ source: 'chunked', serialized: snapshot });
  endMetadataRefreshActivity();
  await jest.advanceTimersByTimeAsync(1000);
  expect(AsyncStorage.getAllKeys).toHaveBeenCalledTimes(1);
});

test('playback extraction defers cleanup even after its UI waiter times out', async () => {
  const native = deferred();
  const waiter = scheduleNativeWaveformExtraction('playing', () => native.promise.then(() => null),
    new AbortController().signal, { timeoutMs: 10 }).catch(error => error);
  await jest.advanceTimersByTimeAsync(130); await waiter;
  await writeStoredSongLibrary(legacyKey, snapshot);
  (AsyncStorage.getAllKeys as jest.Mock).mockClear();
  await jest.advanceTimersByTimeAsync(2000);
  expect(AsyncStorage.getAllKeys).not.toHaveBeenCalled();
  native.resolve(); await jest.advanceTimersByTimeAsync(1000);
  expect(AsyncStorage.getAllKeys).toHaveBeenCalledTimes(1);
});

test('rechecks current manifest keys after a delayed enumeration', async () => {
  await writeStoredSongLibrary(legacyKey, value('old'));
  const oldChunk = await currentChunk();
  await writeStoredSongLibrary(legacyKey, value('new'));
  const held = deferred(); const started = deferred();
  const getKeys = (AsyncStorage.getAllKeys as jest.Mock).getMockImplementation()!;
  jest.spyOn(AsyncStorage, 'getAllKeys').mockImplementationOnce(async () => {
    const keys = await getKeys(); started.resolve(); await held.promise; return keys;
  });
  const cleanup = flushSongLibraryMaintenance(); await started.promise;
  await writeStoredSongLibrary(legacyKey, value('old'));
  held.resolve(); await cleanup;
  expect(await AsyncStorage.getItem(oldChunk)).toBe(value('old'));
  await expect(readStoredSongLibrary(legacyKey)).resolves.toEqual({ source: 'chunked', serialized: value('old') });
});

test('a held native delete blocks only a writer that reuses its reserved content', async () => {
  await writeStoredSongLibrary(legacyKey, value('old'));
  const oldChunk = await currentChunk();
  await writeStoredSongLibrary(legacyKey, value('new'));
  const held = deferred(); const started = deferred();
  const remove = (AsyncStorage.multiRemove as jest.Mock).getMockImplementation()!;
  jest.spyOn(AsyncStorage, 'multiRemove').mockImplementationOnce(async keys => {
    expect(keys).toContain(oldChunk); started.resolve(); await held.promise; return remove(keys);
  });
  const cleanup = flushSongLibraryMaintenance(); await started.promise;
  await writeStoredSongLibrary(legacyKey, value('unrelated'));
  await expect(readStoredSongLibrary(legacyKey)).resolves.toEqual({ source: 'chunked', serialized: value('unrelated') });
  let reused = false;
  const collidingWrite = writeStoredSongLibrary(legacyKey, value('old')).then(() => { reused = true; });
  await tick(); expect(reused).toBe(false);
  held.resolve(); await Promise.all([cleanup, collidingWrite]);
  await expect(readStoredSongLibrary(legacyKey)).resolves.toEqual({ source: 'chunked', serialized: value('old') });
});

test('preserves a legacy rollback requested while an older cleanup enumerates', async () => {
  await writeStoredSongLibrary(legacyKey, value('new'));
  const held = deferred(); const started = deferred();
  jest.spyOn(AsyncStorage, 'getAllKeys').mockImplementationOnce(async () => {
    started.resolve(); await held.promise; return [];
  });
  const cleanup = flushSongLibraryMaintenance(); await started.promise;
  await AsyncStorage.setItem(legacyKey, snapshot);
  await writeStoredSongLibrary(legacyKey, value('migrated'), { removeLegacy: false });
  held.resolve(); await cleanup;
  expect(await AsyncStorage.getItem(legacyKey)).toBe(snapshot);
  expect(JSON.parse((await AsyncStorage.getItem(SONG_LIBRARY_MANIFEST_KEY))!).legacyFallbackChecksum).toBeDefined();
});

test('protects removeLegacy:false before waiting for an already reserved native legacy deletion', async () => {
  await AsyncStorage.setItem(legacyKey, snapshot);
  await writeStoredSongLibrary(legacyKey, value('new'));
  const held = deferred(); const started = deferred();
  const remove = (AsyncStorage.removeItem as jest.Mock).getMockImplementation()!;
  jest.spyOn(AsyncStorage, 'removeItem').mockImplementationOnce(async key => {
    started.resolve(); await held.promise; return remove(key);
  });
  const cleanup = flushSongLibraryMaintenance(); await started.promise;
  const migration = writeStoredSongLibrary(legacyKey, value('migrated'), { removeLegacy: false });
  await tick();
  held.resolve(); await migration;
  await AsyncStorage.setItem(legacyKey, snapshot);
  await writeStoredSongLibrary(legacyKey, value('migrated'), { removeLegacy: false });
  await cleanup;
  expect(await AsyncStorage.getItem(legacyKey)).toBe(snapshot);
  await expect(readStoredSongLibrary(legacyKey)).resolves.toEqual({ source: 'chunked', serialized: value('migrated') });
});

test('backup flushing owns scheduled and already running deletions through real settlement', async () => {
  await writeStoredSongLibrary(legacyKey, snapshot);
  const held = deferred(); const started = deferred();
  jest.spyOn(AsyncStorage, 'removeItem').mockImplementationOnce(async () => { started.resolve(); await held.promise; });
  flushPersistenceOwners(); await started.promise;
  let flushed = false; const flush = waitForPersistenceWork().then(() => { flushed = true; });
  await tick(); expect(flushed).toBe(false);
  held.resolve(); await flush;
  expect(flushed).toBe(true);
});

test('an obsolete persistence epoch cannot delete enumerated keys after reset/restore', async () => {
  await writeStoredSongLibrary(legacyKey, snapshot);
  const held = deferred(); const started = deferred();
  await AsyncStorage.setItem(`${SONG_LIBRARY_CHUNK_PREFIX}orphan`, 'keep during reset');
  jest.spyOn(AsyncStorage, 'getAllKeys').mockImplementationOnce(async () => {
    started.resolve(); await held.promise; return [`${SONG_LIBRARY_CHUNK_PREFIX}orphan`];
  });
  const cleanup = flushSongLibraryMaintenance(); await started.promise;
  blockPersistenceForMaintenance(); releasePersistenceMaintenance();
  held.resolve(); await cleanup;
  expect(await AsyncStorage.getItem(`${SONG_LIBRARY_CHUNK_PREFIX}orphan`)).toBe('keep during reset');
});

test('explicit library removal drains delayed cleanup before removing the committed manifest', async () => {
  await writeStoredSongLibrary(legacyKey, snapshot);
  await removeStoredSongLibrary(legacyKey);
  expect(await AsyncStorage.getAllKeys()).toEqual([]);
  await jest.advanceTimersByTimeAsync(2000);
  expect(await AsyncStorage.getAllKeys()).toEqual([]);
});
