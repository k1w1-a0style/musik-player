import type { Song } from '../../types/Song';
import { createCoverCacheProtection } from '../../utils/coverCacheCleanup';
import {
  acquireSongCoverProtection,
  getSongSnapshotKey,
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

describe('getSongSnapshotKey', () => {
  test('returns the same key for the same song state', () => {
    const songs: Song[] = [
      { id: 'a', title: 'A', artist: 'Artist', uri: 'file:///music/a.mp3', cover: 'file:///covers/a.jpg' },
      { id: 'b', title: 'B', artist: 'Artist', uri: 'file:///music/b.mp3', coverInfo: { status: 'cached', uri: 'file:///covers/b.jpg' } },
    ];

    expect(getSongSnapshotKey(songs)).toBe(getSongSnapshotKey(songs.map(song => ({ ...song }))));
  });

  test('changes when relevant cover or artwork metadata changes', () => {
    const baseSong: Song = { id: 'a', title: 'A', artist: 'Artist', uri: 'file:///music/a.mp3', cover: 'file:///covers/a.jpg' };

    expect(getSongSnapshotKey([baseSong])).not.toBe(
      getSongSnapshotKey([{ ...baseSong, cover: 'file:///covers/a-new.jpg' }]),
    );
    expect(getSongSnapshotKey([{ ...baseSong, coverInfo: { status: 'cached', uri: 'file:///covers/a.jpg' } }])).not.toBe(
      getSongSnapshotKey([{ ...baseSong, coverInfo: { status: 'external', uri: 'file:///covers/a.jpg' } }]),
    );
  });

  test('does not copy large base64 covers into the snapshot key', () => {
    const base64Cover = `data:image/jpeg;base64,${'a'.repeat(20_000)}`;
    const key = getSongSnapshotKey([{ id: 'a', title: 'A', artist: 'Artist', cover: base64Cover }]);

    expect(key).not.toContain(base64Cover);
    expect(key.length).toBeLessThan(200);
  });
});

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

test('confirmed cleanup releases hydration handoff when normalized hydration changes snapshot key', () => {
  resetSongCoverProtectionLifecycleForTests();
  jest.clearAllMocks();
  const storedSongs: Song[] = [
    { id: 's1', title: 'One', artist: 'Artist', uri: 'file:///s1.mp3' },
    { id: ' s1 ', title: 'Duplicate', artist: 'Artist', uri: 'file:///s1-duplicate.mp3' },
    { id: 'bad', title: 'Bad', artist: 'Artist', uri: '   ' },
  ];
  const normalizedSongs: Song[] = [
    { id: 's1', title: 'One', artist: 'Artist', uri: 'file:///s1.mp3' },
  ];

  const hydrationLease = acquireSongCoverProtection(storedSongs);
  hydrationLease.updateSnapshot(normalizedSongs);
  hydrationLease.handoffFromHydration(normalizedSongs);

  const confirmedLease = acquireSongCoverProtection(normalizedSongs);
  confirmedLease.prepareConfirmedCleanup(normalizedSongs);
  expect(protectionAt(0).release).not.toHaveBeenCalled();

  confirmedLease.markConfirmedAfterCleanup();

  expect(protectionAt(0).replaceProtectedSongCovers).toHaveBeenCalledWith(normalizedSongs);
  expect(protectionAt(0).release).toHaveBeenCalledTimes(1);
});
