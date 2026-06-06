import type { Song } from '../../types/Song';
import { createCoverCacheProtection } from '../../utils/coverCacheCleanup';
import {
  acquireSongCoverProtection,
  resetSongCoverProtectionLifecycleForTests,
} from '../songCoverProtectionLifecycle';

jest.mock('../../utils/coverCacheCleanup', () => ({
  createCoverCacheProtection: jest.fn(() => ({
    protectUri: jest.fn(),
    protectSongCovers: jest.fn(),
    replaceProtectedSongCovers: jest.fn(),
    release: jest.fn(),
  })),
}));

const songsA: Song[] = [{ id: 'a', title: 'A', artist: 'Artist', cover: 'file:///docs/covers/aaa-bbb.jpg' }];
const songsB: Song[] = [{ id: 'b', title: 'B', artist: 'Artist', cover: 'file:///docs/covers/ccc-ddd.jpg' }];

const protectionAt = (index: number) => (createCoverCacheProtection as jest.Mock).mock.results[index].value;

describe('songCoverProtectionLifecycle', () => {
  beforeEach(() => {
    resetSongCoverProtectionLifecycleForTests();
    jest.clearAllMocks();
  });

  test('does not reinsert a released entry when updateSnapshot runs on a stale lease', () => {
    const staleLease = acquireSongCoverProtection(songsA);
    staleLease.releaseCurrentOwner();

    staleLease.updateSnapshot(songsB);
    const currentLease = acquireSongCoverProtection(songsB);

    expect(protectionAt(0).release).toHaveBeenCalledTimes(1);
    expect(protectionAt(0).protectSongCovers).not.toHaveBeenCalledWith(songsB);
    expect(createCoverCacheProtection).toHaveBeenCalledTimes(2);
    expect(currentLease.protection).toBe(protectionAt(1));
  });

  test('does not reinsert a released entry when handoffToNextEffect runs on a stale lease', () => {
    const staleLease = acquireSongCoverProtection(songsA);
    staleLease.releaseCurrentOwner();

    staleLease.handoffToNextEffect(songsB);
    const currentLease = acquireSongCoverProtection(songsB);

    expect(protectionAt(0).release).toHaveBeenCalledTimes(1);
    expect(protectionAt(0).protectSongCovers).not.toHaveBeenCalledWith(songsB);
    expect(createCoverCacheProtection).toHaveBeenCalledTimes(2);
    expect(currentLease.protection).toBe(protectionAt(1));
  });

  test('does not reinsert a released entry when handoffFromHydration runs on a stale lease', () => {
    const staleLease = acquireSongCoverProtection(songsA);
    staleLease.releaseCurrentOwner();

    staleLease.handoffFromHydration(songsB);
    const currentLease = acquireSongCoverProtection(songsB);

    expect(protectionAt(0).release).toHaveBeenCalledTimes(1);
    expect(protectionAt(0).protectSongCovers).not.toHaveBeenCalledWith(songsB);
    expect(createCoverCacheProtection).toHaveBeenCalledTimes(2);
    expect(currentLease.protection).toBe(protectionAt(1));
  });

  test('does not release an older protection while its persistence can still commit', () => {
    const older = acquireSongCoverProtection(songsA);
    older.markPersisting();
    older.releaseCurrentOwner();

    const newer = acquireSongCoverProtection(songsB);

    expect(protectionAt(0).release).not.toHaveBeenCalled();
    newer.releaseCurrentOwner();
    expect(protectionAt(0).release).not.toHaveBeenCalled();
  });

  test('releases a dropped pending snapshot without provisional stored ownership', () => {
    const dropped = acquireSongCoverProtection(songsB);
    dropped.markPersisting();
    dropped.releaseCurrentOwner();

    dropped.finishPersistence({ status: 'dropped' });
    const reacquired = acquireSongCoverProtection(songsB);

    expect(protectionAt(0).release).toHaveBeenCalledTimes(1);
    expect(createCoverCacheProtection).toHaveBeenCalledTimes(2);
    expect(reacquired.protection).toBe(protectionAt(1));
  });

  test('retains an older successfully written snapshot when the newer persistence fails', () => {
    const older = acquireSongCoverProtection(songsA);
    older.markPersisting();
    older.releaseCurrentOwner();
    const newer = acquireSongCoverProtection(songsB);
    newer.markPersisting();

    older.finishPersistence({ status: 'superseded' });
    newer.finishPersistence({ status: 'failed', error: new Error('newer failed') });
    newer.releaseCurrentOwner();

    expect(protectionAt(0).release).not.toHaveBeenCalled();
  });

  test('releases an older provisional stored snapshot after a newer snapshot confirms', () => {
    const older = acquireSongCoverProtection(songsA);
    older.markPersisting();
    older.releaseCurrentOwner();
    const newer = acquireSongCoverProtection(songsB);
    newer.markPersisting();

    older.finishPersistence({ status: 'superseded' });
    expect(protectionAt(0).release).not.toHaveBeenCalled();

    newer.finishPersistence({ status: 'stored' });

    expect(protectionAt(0).release).toHaveBeenCalledTimes(1);
    expect(protectionAt(1).release).toHaveBeenCalledTimes(1);
  });

  test('prepares confirmed cleanup by releasing older provisional entries while preserving active owners', () => {
    const older = acquireSongCoverProtection(songsA);
    older.markPersisting();
    older.releaseCurrentOwner();
    older.finishPersistence({ status: 'superseded' });

    const confirmed = acquireSongCoverProtection(songsB);
    confirmed.markPersisting();
    const pending = acquireSongCoverProtection([{ ...songsA[0], id: 'c', cover: 'file:///docs/covers/eee-fff.jpg' }]);
    pending.markPersisting();
    pending.releaseCurrentOwner();

    confirmed.prepareConfirmedCleanup(songsB);

    expect(protectionAt(0).release).toHaveBeenCalledTimes(1);
    expect(protectionAt(1).replaceProtectedSongCovers).toHaveBeenCalledWith(songsB);
    expect(protectionAt(1).release).not.toHaveBeenCalled();
    expect(protectionAt(2).release).not.toHaveBeenCalled();
  });

  test('releases an older in-flight snapshot that finishes after a newer snapshot confirmed', () => {
    const older = acquireSongCoverProtection(songsA);
    older.markPersisting();
    older.releaseCurrentOwner();
    const newer = acquireSongCoverProtection(songsB);
    newer.markPersisting();

    newer.finishPersistence({ status: 'stored' });
    expect(protectionAt(0).release).not.toHaveBeenCalled();

    older.finishPersistence({ status: 'superseded' });

    expect(protectionAt(0).release).toHaveBeenCalledTimes(1);
  });

  test('adopts a hydration handoff and releases it after later confirmed persistence', () => {
    const hydration = acquireSongCoverProtection(songsA);
    hydration.handoffFromHydration(songsA);

    const persistence = acquireSongCoverProtection(songsA);
    persistence.markPersisting();

    expect(createCoverCacheProtection).toHaveBeenCalledTimes(1);
    expect(protectionAt(0).release).not.toHaveBeenCalled();

    persistence.finishPersistence({ status: 'unchanged' });

    expect(protectionAt(0).release).toHaveBeenCalledTimes(1);
  });

  test('releases an abandoned hydration handoff after a different snapshot confirms', () => {
    const hydration = acquireSongCoverProtection(songsA);
    hydration.handoffFromHydration(songsA);
    const persistence = acquireSongCoverProtection(songsB);
    persistence.markPersisting();

    persistence.finishPersistence({ status: 'stored' });

    expect(protectionAt(0).release).toHaveBeenCalledTimes(1);
  });
});
