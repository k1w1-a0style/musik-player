import React, { useRef, useState } from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { usePersistedSetting } from '../usePersistedSetting';
import { usePersistedSongs } from '../usePersistedSongs';
import { StorageKeys, storage } from '../../utils/storage';
import type { Song } from '../../types/Song';
import {
  acquireSongCoverProtection,
  resetSongCoverProtectionLifecycleForTests,
} from '../songCoverProtectionLifecycle';

jest.mock('../../utils/coverCacheCleanup', () => ({
  cleanupCoverCache: jest.fn(async () => undefined),
  createCoverCacheProtection: jest.fn(() => ({
    protectUri: jest.fn(),
    protectSongCovers: jest.fn(),
    release: jest.fn(),
  })),
  invalidateCoverCacheCleanup: jest.fn(),
  waitForCoverCacheCleanupIdle: jest.fn(async () => undefined),
}));

jest.mock('../musicPersistenceHelpers', () => ({
  persistIfChanged: jest.fn(async () => ({ status: 'stored' })),
  prepareSongsForPersistence: jest.fn(async (songs: Song[]) => ({
    sanitizedSongs: songs,
    coversChanged: false,
  })),
}));

const cleanupHelpers = jest.requireMock('../../utils/coverCacheCleanup') as {
  cleanupCoverCache: jest.Mock;
  createCoverCacheProtection: jest.Mock;
};

const helpers = jest.requireMock('../musicPersistenceHelpers') as {
  persistIfChanged: jest.Mock;
  prepareSongsForPersistence: jest.Mock;
};

const songs: Song[] = [{ id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' }];

const PersistedSettingProbe = ({ ready = true }: { ready?: boolean }) => {
  const refs = useRef<Record<string, string>>({});
  usePersistedSetting(ready, StorageKeys.VOLUME, 0.5, refs);
  return null;
};

const PersistedSongsStateBridgeProbe = () => {
  const [currentSongs, setCurrentSongs] = useState(songs);
  const refs = useRef<Record<string, string>>({});
  usePersistedSongs(true, currentSongs, setCurrentSongs, refs);
  return null;
};

const PersistedSongsProbe = ({
  ready = true,
  setSongsState = jest.fn(),
}: {
  ready?: boolean;
  setSongsState?: (items: Song[]) => void;
}) => {
  const refs = useRef<Record<string, string>>({});
  usePersistedSongs(ready, songs, setSongsState, refs);
  return null;
};

describe('persisted hooks', () => {
  beforeEach(() => {
    resetSongCoverProtectionLifecycleForTests();
    jest.clearAllMocks();
  });

  test('usePersistedSetting persists only when provider is ready', async () => {
    render(<PersistedSettingProbe ready={false} />);
    await waitFor(() => expect(helpers.persistIfChanged).not.toHaveBeenCalled());

    render(<PersistedSettingProbe ready />);
    await waitFor(() => expect(helpers.persistIfChanged).toHaveBeenCalledWith(StorageKeys.VOLUME, 0.5, {}));
  });

  test('usePersistedSetting swallows async persistence rejection', async () => {
    helpers.persistIfChanged.mockRejectedValueOnce(new Error('persist rejected'));

    render(<PersistedSettingProbe ready />);

    await waitFor(() => expect(helpers.persistIfChanged).toHaveBeenCalledTimes(1));
  });

  test('usePersistedSongs persists sanitized songs', async () => {
    render(<PersistedSongsProbe ready />);

    await waitFor(() => expect(helpers.prepareSongsForPersistence).toHaveBeenCalledWith(songs, expect.objectContaining({ protectSongCovers: expect.any(Function) })));
    await waitFor(() => expect(helpers.persistIfChanged).toHaveBeenCalledWith(StorageKeys.SONGS, songs, {}));
  });

  test('does not move or persist a snapshot when prepare resolves after effect cancellation', async () => {
    let resolvePrepare!: (value: { sanitizedSongs: Song[]; coversChanged: boolean }) => void;
    const prepareResult = new Promise<{ sanitizedSongs: Song[]; coversChanged: boolean }>(resolve => {
      resolvePrepare = resolve;
    });
    const sanitized = [{ ...songs[0], cover: 'file:///docs/covers/abc-def.jpg' }];
    const setSongsState = jest.fn();
    helpers.prepareSongsForPersistence.mockReturnValueOnce(prepareResult);

    const { unmount } = render(<PersistedSongsProbe setSongsState={setSongsState} />);
    await waitFor(() => expect(helpers.prepareSongsForPersistence).toHaveBeenCalledTimes(1));
    const releasedProtection = cleanupHelpers.createCoverCacheProtection.mock.results[0].value;

    unmount();
    expect(releasedProtection.release).toHaveBeenCalledTimes(1);

    resolvePrepare({ sanitizedSongs: sanitized, coversChanged: true });
    await Promise.resolve();
    await Promise.resolve();

    expect(setSongsState).not.toHaveBeenCalled();
    expect(helpers.persistIfChanged).not.toHaveBeenCalled();
    expect(cleanupHelpers.cleanupCoverCache).not.toHaveBeenCalled();

    const laterLease = acquireSongCoverProtection(sanitized);
    expect(cleanupHelpers.createCoverCacheProtection).toHaveBeenCalledTimes(2);
    expect(laterLease.protection).not.toBe(releasedProtection);
    laterLease.releaseCurrentOwner();
  });

  test('usePersistedSongs updates state when cover cache sanitizing changed songs', async () => {
    const sanitized = [{ ...songs[0], cover: 'file:///cached-cover.jpg' }];
    const setSongsState = jest.fn();
    helpers.prepareSongsForPersistence.mockResolvedValueOnce({ sanitizedSongs: sanitized, coversChanged: true });

    render(<PersistedSongsProbe ready setSongsState={setSongsState} />);

    await waitFor(() => expect(setSongsState).toHaveBeenCalledWith(sanitized));
    expect(helpers.persistIfChanged).not.toHaveBeenCalled();
  });

  test('bridges changed sanitized cover protection to the next persistence effect', async () => {
    let resolvePersist!: (result: { status: 'stored' }) => void;
    const persistResult = new Promise<{ status: 'stored' }>(resolve => {
      resolvePersist = resolve;
    });
    const sanitized = [{ ...songs[0], cover: 'file:///docs/covers/abc-def.jpg' }];
    helpers.prepareSongsForPersistence
      .mockResolvedValueOnce({ sanitizedSongs: sanitized, coversChanged: true })
      .mockResolvedValueOnce({ sanitizedSongs: sanitized, coversChanged: false });
    helpers.persistIfChanged.mockReturnValueOnce(persistResult);

    render(<PersistedSongsStateBridgeProbe />);

    await waitFor(() => expect(cleanupHelpers.createCoverCacheProtection).toHaveBeenCalledTimes(1));
    const adoptedProtection = cleanupHelpers.createCoverCacheProtection.mock.results[0].value;
    expect(adoptedProtection.protectSongCovers).toHaveBeenCalledWith(sanitized);
    expect(adoptedProtection.release).not.toHaveBeenCalled();
    await waitFor(() => expect(helpers.persistIfChanged).toHaveBeenCalledWith(StorageKeys.SONGS, sanitized, {}));
    expect(adoptedProtection.release).not.toHaveBeenCalled();
    expect(cleanupHelpers.cleanupCoverCache).not.toHaveBeenCalled();

    resolvePersist({ status: 'stored' });
    await waitFor(() => expect(cleanupHelpers.cleanupCoverCache).toHaveBeenCalledWith(sanitized));
    await waitFor(() => expect(adoptedProtection.release).toHaveBeenCalledTimes(1));
  });

  test('awaits post-commit cover cleanup before releasing snapshot protection', async () => {
    let resolveCleanup!: () => void;
    const cleanupResult = new Promise<void>(resolve => {
      resolveCleanup = resolve;
    });
    cleanupHelpers.cleanupCoverCache.mockReturnValueOnce(cleanupResult);

    render(<PersistedSongsProbe />);

    await waitFor(() => expect(cleanupHelpers.cleanupCoverCache).toHaveBeenCalledWith(songs));
    const protection = cleanupHelpers.createCoverCacheProtection.mock.results[0].value;
    expect(protection.release).not.toHaveBeenCalled();

    resolveCleanup();

    await waitFor(() => expect(protection.release).toHaveBeenCalledTimes(1));
  });

  test('usePersistedSongs swallows prepare or persist errors', async () => {
    helpers.prepareSongsForPersistence.mockRejectedValueOnce(new Error('prepare rejected'));

    render(<PersistedSongsProbe ready />);

    await waitFor(() => expect(helpers.prepareSongsForPersistence).toHaveBeenCalledTimes(1));
  });
});
