import * as FileSystem from 'expo-file-system/legacy';
import { cleanupCoverCache, resetCoverCacheCleanupForTests } from '../../utils/coverCacheCleanup';
import {
  acquireSongCoverProtection, protectAcceptedSongCovers, resetSongCoverProtectionLifecycleForTests,
} from '../songCoverProtectionLifecycle';
import type { Song } from '../../types/Song';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  getInfoAsync: jest.fn(async () => ({ exists: true })),
  readDirectoryAsync: jest.fn(async () => ['aaa-bbb.jpg', 'ccc-ddd.jpg']),
  deleteAsync: jest.fn(async () => undefined),
}));

const song = (id: string, file: string): Song => ({ id, title: id, artist: 'Artist', cover: `file:///docs/covers/${file}` });
const oldBatch = [song('a', 'aaa-bbb.jpg')];
const latestBatch = [song('b', 'ccc-ddd.jpg')];

beforeEach(() => {
  resetSongCoverProtectionLifecycleForTests();
  resetCoverCacheCleanupForTests();
  jest.clearAllMocks();
});
afterEach(resetSongCoverProtectionLifecycleForTests);

test('accepted cover survives cleanup before React persistence, even when intermediate renders are skipped', async () => {
  protectAcceptedSongCovers(oldBatch);
  protectAcceptedSongCovers(latestBatch);
  await cleanupCoverCache([]);
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///docs/covers/aaa-bbb.jpg', { idempotent: true });
  expect(FileSystem.deleteAsync).not.toHaveBeenCalledWith('file:///docs/covers/ccc-ddd.jpg', expect.anything());

  const effect = acquireSongCoverProtection(latestBatch);
  effect.markPersisting();
  await cleanupCoverCache([]);
  expect(FileSystem.deleteAsync).not.toHaveBeenCalledWith('file:///docs/covers/ccc-ddd.jpg', expect.anything());
  effect.finishPersistence({ status: 'failed', error: new Error('disk full') });
  await cleanupCoverCache([]);
  expect(FileSystem.deleteAsync).not.toHaveBeenCalledWith('file:///docs/covers/ccc-ddd.jpg', expect.anything());

  effect.releaseCurrentOwner();
  await cleanupCoverCache([]);
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///docs/covers/ccc-ddd.jpg', { idempotent: true });
});

test('an older effect cannot claim a newer accepted handoff', async () => {
  protectAcceptedSongCovers(latestBatch);
  const stale = acquireSongCoverProtection(oldBatch);
  stale.releaseCurrentOwner();
  await cleanupCoverCache([]);
  expect(FileSystem.deleteAsync).not.toHaveBeenCalledWith('file:///docs/covers/ccc-ddd.jpg', expect.anything());
});
