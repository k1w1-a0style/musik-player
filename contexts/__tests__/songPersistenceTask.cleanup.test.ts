import type { Song } from '../../types/Song';
import { cleanupCoverCache, createCoverCacheProtection } from '../../utils/coverCacheCleanup';
import { createSongPersistenceTask } from '../songPersistenceTask';
import { resetSongCoverProtectionLifecycleForTests } from '../songCoverProtectionLifecycle';
import * as persistence from '../musicPersistenceHelpers';

jest.mock('../../utils/coverCacheCleanup', () => ({
  cleanupCoverCache: jest.fn(),
  createCoverCacheProtection: jest.fn(() => ({ protectUri: jest.fn(), protectSongCovers: jest.fn(),
    replaceProtectedSongCovers: jest.fn(), release: jest.fn() })),
}));
const song: Song = { id: 'committed', title: 'Stored', artist: 'Artist', cover: 'file:///cover-cache/committed.png' };
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(release => { resolve = release; }); return { promise, resolve };
};
const settle = async () => { for (let index = 0; index < 20; index += 1) await Promise.resolve(); };
beforeEach(() => {
  resetSongCoverProtectionLifecycleForTests(); jest.clearAllMocks();
  jest.spyOn(persistence, 'prepareSongsForPersistence').mockImplementation(async songs => ({ sanitizedSongs: songs, coversChanged: false }));
  jest.spyOn(persistence, 'persistIfChanged').mockResolvedValue({ status: 'stored' });
});
afterEach(() => { resetSongCoverProtectionLifecycleForTests(); jest.restoreAllMocks(); });

test.each(['stored', 'unchanged'] as const)('publishes confirmed %s before slow cleanup while retaining cover ownership', async status => {
  jest.mocked(persistence.persistIfChanged).mockResolvedValue({ status });
  const cleanup = deferred(); jest.mocked(cleanupCoverCache).mockReturnValue(cleanup.promise);
  const task = createSongPersistenceTask([song], jest.fn(), { current: {} });
  let completed = false;
  const result = task.start().then(value => { completed = true; return value; });
  await settle();
  const completedBeforeCleanup = completed;
  const protection = jest.mocked(createCoverCacheProtection).mock.results[0].value;
  task.cancel();
  expect(protection.release).not.toHaveBeenCalled();
  // eslint-disable-next-line no-console -- Lifecycle boundary measurement with explicitly unresolved cleanup, not device milliseconds.
  console.info(JSON.stringify({ scope: 'host persistence lifecycle with confirmed-write and cleanup boundary doubles', status, completedBeforeCleanup }));
  cleanup.resolve();
  await expect(result).resolves.toEqual({ status }); await settle();
  expect(protection.release).toHaveBeenCalledTimes(1);
  expect(completedBeforeCleanup).toBe(true);
});

test('keeps the newer snapshot protected when the older cleanup settles last', async () => {
  const oldCleanup = deferred(); const newCleanup = deferred();
  jest.mocked(cleanupCoverCache).mockReturnValueOnce(oldCleanup.promise).mockReturnValueOnce(newCleanup.promise);
  const old = createSongPersistenceTask([song], jest.fn(), { current: {} });
  await expect(old.start(true)).resolves.toEqual({ status: 'stored' });
  const newer = { ...song, id: 'newer', cover: 'file:///cover-cache/newer.png' };
  const next = createSongPersistenceTask([newer], jest.fn(), { current: {} });
  await expect(next.start(true)).resolves.toEqual({ status: 'stored' });
  const oldProtection = jest.mocked(createCoverCacheProtection).mock.results[0].value;
  const nextProtection = jest.mocked(createCoverCacheProtection).mock.results[1].value;
  expect(oldProtection.release).not.toHaveBeenCalled(); expect(nextProtection.release).not.toHaveBeenCalled();
  newCleanup.resolve(); await settle();
  expect(nextProtection.release).toHaveBeenCalledTimes(1); expect(oldProtection.release).not.toHaveBeenCalled();
  oldCleanup.resolve(); await settle();
  expect(oldProtection.release).toHaveBeenCalledTimes(1); expect(nextProtection.release).toHaveBeenCalledTimes(1);
});

test('cleanup failure does not turn a confirmed write into a storage failure or leak ownership', async () => {
  const cleanup = deferred();
  const failure = cleanup.promise.then(() => { throw new Error('cleanup unavailable'); });
  jest.mocked(cleanupCoverCache).mockReturnValue(failure);
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const task = createSongPersistenceTask([song], jest.fn(), { current: {} });
  await expect(task.start(true)).resolves.toEqual({ status: 'stored' });
  const protection = jest.mocked(createCoverCacheProtection).mock.results[0].value;
  expect(protection.release).not.toHaveBeenCalled();
  cleanup.resolve(); await settle();
  expect(warn).toHaveBeenCalledWith('[usePersistedSongs] Cover cache cleanup failed:', expect.any(Error));
  expect(protection.release).toHaveBeenCalledTimes(1);
});

test('a synchronous cleanup-dispatch failure remains best-effort after a confirmed commit', async () => {
  jest.mocked(cleanupCoverCache).mockImplementation(() => { throw new Error('dispatch unavailable'); });
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const task = createSongPersistenceTask([song], jest.fn(), { current: {} });
  await expect(task.start(true)).resolves.toEqual({ status: 'stored' }); await settle();
  expect(warn).toHaveBeenCalledWith('[usePersistedSongs] Cover cache cleanup failed:', expect.any(Error));
  const protection = jest.mocked(createCoverCacheProtection).mock.results[0].value;
  expect(protection.release).toHaveBeenCalledTimes(1);
});

test('a late superseded write never starts cleanup and remains protected until a newer confirmed cleanup', async () => {
  const write = deferred(); const cleanup = deferred();
  jest.mocked(persistence.persistIfChanged).mockImplementationOnce(async () => { await write.promise; return { status: 'stored' }; });
  jest.mocked(cleanupCoverCache).mockReturnValue(cleanup.promise);
  const old = createSongPersistenceTask([song], jest.fn(), { current: {} });
  const pending = old.start(); await settle(); old.cancel(); write.resolve();
  await expect(pending).resolves.toEqual({ status: 'superseded' });
  expect(cleanupCoverCache).not.toHaveBeenCalled();
  const oldProtection = jest.mocked(createCoverCacheProtection).mock.results[0].value;
  expect(oldProtection.release).not.toHaveBeenCalled();
  const newer = { ...song, id: 'newer', cover: 'file:///cover-cache/newer.png' };
  const next = createSongPersistenceTask([newer], jest.fn(), { current: {} });
  await expect(next.start(true)).resolves.toEqual({ status: 'stored' });
  expect(oldProtection.release).toHaveBeenCalledTimes(1);
  const nextProtection = jest.mocked(createCoverCacheProtection).mock.results[1].value;
  expect(nextProtection.release).not.toHaveBeenCalled();
  cleanup.resolve(); await settle(); expect(nextProtection.release).toHaveBeenCalledTimes(1);
});
