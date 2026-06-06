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

  test('does not release an older protection while its persistence can still commit', () => {
    const older = acquireSongCoverProtection(songsA);
    older.markPersisting();
    older.releaseCurrent();

    const newer = acquireSongCoverProtection(songsB);

    expect(protectionAt(0).release).not.toHaveBeenCalled();
    newer.releaseCurrent();
    expect(protectionAt(0).release).not.toHaveBeenCalled();
  });

  test('retains an older successfully written snapshot when the newer persistence fails', () => {
    const older = acquireSongCoverProtection(songsA);
    older.markPersisting();
    older.releaseCurrent();
    const newer = acquireSongCoverProtection(songsB);
    newer.markPersisting();

    older.finishPersistence({ status: 'superseded' });
    newer.finishPersistence({ status: 'failed', error: new Error('newer failed') });
    newer.releaseCurrent();

    expect(protectionAt(0).release).not.toHaveBeenCalled();
  });

  test('releases an older provisional stored snapshot after a newer snapshot confirms', () => {
    const older = acquireSongCoverProtection(songsA);
    older.markPersisting();
    older.releaseCurrent();
    const newer = acquireSongCoverProtection(songsB);
    newer.markPersisting();

    older.finishPersistence({ status: 'superseded' });
    expect(protectionAt(0).release).not.toHaveBeenCalled();

    newer.finishPersistence({ status: 'stored' });

    expect(protectionAt(0).release).toHaveBeenCalledTimes(1);
    expect(protectionAt(1).release).toHaveBeenCalledTimes(1);
  });

  test('adopts a hydration handoff and releases it after later confirmed persistence', () => {
    const hydration = acquireSongCoverProtection(songsA);
    hydration.handoff(songsA);

    const persistence = acquireSongCoverProtection(songsA);
    persistence.markPersisting();

    expect(createCoverCacheProtection).toHaveBeenCalledTimes(1);
    expect(protectionAt(0).release).not.toHaveBeenCalled();

    persistence.finishPersistence({ status: 'unchanged' });

    expect(protectionAt(0).release).toHaveBeenCalledTimes(1);
  });

  test('releases an abandoned hydration handoff after a different snapshot confirms', () => {
    const hydration = acquireSongCoverProtection(songsA);
    hydration.handoff(songsA);
    const persistence = acquireSongCoverProtection(songsB);
    persistence.markPersisting();

    persistence.finishPersistence({ status: 'stored' });

    expect(protectionAt(0).release).toHaveBeenCalledTimes(1);
  });
});
