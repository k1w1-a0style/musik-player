import React, { useRef, useState } from 'react';
import { AppState, Text, type AppStateStatus } from 'react-native';
import { act, render, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePersistedSongs } from '../usePersistedSongs';
import * as musicPersistenceHelpers from '../musicPersistenceHelpers';
import { cleanupCoverCache, createCoverCacheProtection } from '../../utils/coverCacheCleanup';
import { StorageKeys, storage } from '../../utils/storage';
import type { Song } from '../../types/Song';
import { resetSongCoverProtectionLifecycleForTests } from '../songCoverProtectionLifecycle';

jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///docs/',
  EncodingType: { Base64: 'base64' },
  makeDirectoryAsync: jest.fn(async () => undefined),
  writeAsStringAsync: jest.fn(async () => undefined),
}));

jest.mock('../../utils/coverCacheCleanup', () => ({
  cleanupCoverCache: jest.fn(async () => undefined),
  createCoverCacheProtection: jest.fn(() => ({
    protectUri: jest.fn(),
    protectSongCovers: jest.fn(),
    replaceProtectedSongCovers: jest.fn(),
    release: jest.fn(),
  })),
  resetCoverCacheCleanupForTests: jest.fn(),
  waitForCoverCacheCleanupIdle: jest.fn(async () => undefined),
}));

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///docs/',
  EncodingType: { Base64: 'base64' },
  makeDirectoryAsync: jest.fn(async () => undefined),
  writeAsStringAsync: jest.fn(async () => undefined),
  getInfoAsync: jest.fn(async () => ({ exists: false })),
}));

const songs: Song[] = [{ id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' }];
const newerSongs: Song[] = [{ id: 's2', title: 'Two', artist: 'B', uri: 'file:///s2.mp3' }];

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

const createDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const PersistedSongsWithInitialRefsProbe = ({
  currentSongs,
  initialRefs,
}: {
  currentSongs: Song[];
  initialRefs: Record<string, string>;
}) => {
  const persistedRefs = useRef<Record<string, string>>({ ...initialRefs });
  usePersistedSongs(true, currentSongs, jest.fn(), persistedRefs);
  return null;
};

const PersistedSongsProbe = ({ ready }: { ready: boolean }) => {
  const [currentSongs, setCurrentSongs] = useState(songs);
  const persistedRefs = useRef<Record<string, string>>({});
  usePersistedSongs(ready, currentSongs, setCurrentSongs, persistedRefs);
  return <Text testID="songs-count">{currentSongs.length}</Text>;
};

describe('usePersistedSongs', () => {
  beforeEach(async () => {
    resetSongCoverProtectionLifecycleForTests();
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  test('does not persist before ready', async () => {
    render(<PersistedSongsProbe ready={false} />);

    await waitFor(async () => {
      expect(await storage.get(StorageKeys.SONGS)).toBeNull();
    });
  });

  test('persists songs after ready', async () => {
    render(<PersistedSongsProbe ready />);

    await waitFor(async () => {
      expect(await storage.get(StorageKeys.SONGS)).toEqual(songs);
    });
  });

  test('flushes the latest accepted library when readiness closes inside the debounce', async () => {
    jest.useFakeTimers();
    const original = Array.from({ length: 100 }, (_, index) => ({ ...songs[0], id: `s${index}` }));
    const edited = original.map((song, index) => index ? song : { ...song, title: 'Accepted edit' });
    await storage.set(StorageKeys.SONGS, original);
    const persistedRefs = { current: { [StorageKeys.SONGS]: JSON.stringify(original) } };
    const setSongs = jest.fn();
    const view = renderHook<ReturnType<typeof usePersistedSongs>, { ready: boolean; currentSongs: Song[] }>(
      ({ ready, currentSongs }) => usePersistedSongs(ready, currentSongs, setSongs, persistedRefs),
      { initialProps: { ready: true, currentSongs: original } });
    view.rerender({ ready: true, currentSongs: edited });
    view.rerender({ ready: false, currentSongs: edited });
    await act(async () => { await jest.advanceTimersByTimeAsync(1000); });
    expect(await storage.get(StorageKeys.SONGS)).toEqual(edited);
    view.unmount();
    jest.useRealTimers();
  });

  test('a recovery flush settles older background preparation before committing the newest snapshot', async () => {
    jest.useFakeTimers();
    const preparation = createDeferred<void>();
    const originalPrepare = musicPersistenceHelpers.prepareSongsForPersistence;
    jest.spyOn(musicPersistenceHelpers, 'prepareSongsForPersistence').mockImplementation(async (...args) => {
      if (args[0][0].title === 'Older') await preparation.promise;
      return originalPrepare(...args);
    });
    let onAppState!: (state: AppStateStatus) => void;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      onAppState = listener;
      return { remove: jest.fn() };
    });
    const older = Array.from({ length: 100 }, (_, index) => ({ ...songs[0], id: `s${index}`, title: 'Older' }));
    const newest = older.map(song => ({ ...song, title: 'Newest' }));
    const persistedRefs = { current: {} };
    const setSongs = jest.fn();
    const view = renderHook<ReturnType<typeof usePersistedSongs>, { ready: boolean; currentSongs: Song[] }>(
      ({ ready, currentSongs }) => usePersistedSongs(ready, currentSongs, setSongs, persistedRefs),
      { initialProps: { ready: true, currentSongs: older } });
    await act(async () => { onAppState('background'); });
    view.rerender({ ready: true, currentSongs: newest });
    view.rerender({ ready: false, currentSongs: newest });
    let settled = false;
    const flush = view.result.current().then(result => { settled = true; return result; });
    await act(async () => { await Promise.resolve(); });
    expect(settled).toBe(false);
    await act(async () => { preparation.resolve(); await flush; });
    expect(await flush).toEqual({ status: 'idle' });
    expect(await storage.get(StorageKeys.SONGS)).toEqual(newest);
    view.unmount();
    jest.useRealTimers();
  });

  test.each(['readiness', 'unmount'])('a %s flush retains the in-flight latest snapshot and its covers until preparation settles', async event => {
    jest.useFakeTimers();
    const preparation = createDeferred<void>();
    const originalPrepare = musicPersistenceHelpers.prepareSongsForPersistence;
    jest.spyOn(musicPersistenceHelpers, 'prepareSongsForPersistence').mockImplementation(async (...args) => {
      await preparation.promise;
      return originalPrepare(...args);
    });
    const currentSongs = Array.from({ length: 100 }, (_, index) => ({ ...songs[0], id: `s${index}` }));
    const persistedRefs = { current: {} };
    const setSongs = jest.fn();
    const view = renderHook<ReturnType<typeof usePersistedSongs>, { ready: boolean }>(
      ({ ready }) => usePersistedSongs(ready, currentSongs, setSongs, persistedRefs),
      { initialProps: { ready: true } });
    await act(async () => { jest.advanceTimersByTime(350); });
    if (event === 'unmount') view.unmount();
    else view.rerender({ ready: false });
    expect((createCoverCacheProtection as jest.Mock).mock.results[0].value.release).not.toHaveBeenCalled();
    await act(async () => { preparation.resolve(); });
    await waitFor(async () => expect(await storage.get(StorageKeys.SONGS)).toEqual(currentSongs));
    expect((createCoverCacheProtection as jest.Mock).mock.results[0].value.release).toHaveBeenCalledTimes(1);
  });

  test('coalesces 600-song updates before preparation and stores only the newest snapshot', async () => {
    jest.useFakeTimers();
    const prepare = jest.spyOn(musicPersistenceHelpers, 'prepareSongsForPersistence');
    const makeLibrary = (revision: number): Song[] => Array.from({ length: 600 }, (_, index) => ({
      id: `s${index}`, title: `Title ${revision}`, artist: 'A', uri: `file:///s${index}.mp3`,
    }));
    const initialRefs = {};
    const { rerender, unmount } = render(<PersistedSongsWithInitialRefsProbe currentSongs={makeLibrary(1)} initialRefs={initialRefs} />);
    const newest = makeLibrary(3);
    rerender(<PersistedSongsWithInitialRefsProbe currentSongs={makeLibrary(2)} initialRefs={initialRefs} />);
    rerender(<PersistedSongsWithInitialRefsProbe currentSongs={newest} initialRefs={initialRefs} />);
    expect(prepare).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(350); });
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(await storage.get(StorageKeys.SONGS)).toEqual(newest);
    unmount();
    jest.useRealTimers();
  });

  test.each(['background', 'unmount'])('flushes the latest deferred library on %s', async event => {
    jest.useFakeTimers();
    let appStateListener: ((state: AppStateStatus) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      appStateListener = listener;
      return { remove: jest.fn() };
    });
    const largeSongs = Array.from({ length: 100 }, (_, index) => ({ ...songs[0], id: `s${index}` }));
    const { unmount } = render(<PersistedSongsWithInitialRefsProbe currentSongs={largeSongs} initialRefs={{}} />);
    await act(async () => {
      if (event === 'unmount') unmount();
      else appStateListener?.('background');
    });
    expect(await storage.get(StorageKeys.SONGS)).toEqual(largeSongs);
    if (event !== 'unmount') unmount();
    jest.useRealTimers();
  });

  test('bounds coalescing during a continuous import to two seconds', async () => {
    jest.useFakeTimers();
    const prepare = jest.spyOn(musicPersistenceHelpers, 'prepareSongsForPersistence');
    const initialRefs = {};
    const makeLibrary = (revision: number) => Array.from({ length: 100 }, (_, index) => ({ ...songs[0], id: `s${index}`, title: `Title ${revision}` }));
    const { rerender, unmount } = render(<PersistedSongsWithInitialRefsProbe currentSongs={makeLibrary(0)} initialRefs={initialRefs} />);
    for (let revision = 1; revision <= 9; revision += 1) {
      await act(async () => { jest.advanceTimersByTime(200); });
      rerender(<PersistedSongsWithInitialRefsProbe currentSongs={makeLibrary(revision)} initialRefs={initialRefs} />);
    }
    expect(prepare).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(200); });
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(await storage.get(StorageKeys.SONGS)).toEqual(makeLibrary(9));
    unmount();
    jest.useRealTimers();
  });


  test('runs cover cleanup after a stored songs commit', async () => {
    jest.spyOn(musicPersistenceHelpers, 'persistIfChanged').mockResolvedValueOnce({ status: 'stored' });

    render(<PersistedSongsProbe ready />);

    await waitFor(() => expect(cleanupCoverCache).toHaveBeenCalledWith(songs));
  });

  test('runs cover cleanup after unchanged when the exact sanitized snapshot is already persisted', async () => {
    jest.spyOn(musicPersistenceHelpers, 'persistIfChanged').mockResolvedValueOnce({ status: 'unchanged' });

    render(<PersistedSongsProbe ready />);

    await waitFor(() => expect(cleanupCoverCache).toHaveBeenCalledWith(songs));
  });


  test('does not run cleanup for a reverted snapshot until in-flight persistence commits it safely', async () => {
    const newerWrite = createDeferred<boolean>();
    const revertedWrite = createDeferred<boolean>();
    const persistSpy = jest.spyOn(musicPersistenceHelpers, 'persistIfChanged');
    const setSpy = jest.spyOn(storage, 'set')
      .mockImplementationOnce(async () => newerWrite.promise)
      .mockImplementationOnce(async () => revertedWrite.promise);
    const initialRefs = { [StorageKeys.SONGS]: JSON.stringify(songs) };

    const { rerender } = render(<PersistedSongsWithInitialRefsProbe currentSongs={newerSongs} initialRefs={initialRefs} />);
    await waitFor(() => expect(setSpy).toHaveBeenCalledTimes(1));

    rerender(<PersistedSongsWithInitialRefsProbe currentSongs={songs} initialRefs={initialRefs} />);
    await waitFor(() => expect(persistSpy).toHaveBeenCalledTimes(2));
    expect(createCoverCacheProtection).toHaveBeenCalledTimes(2);
    expect((createCoverCacheProtection as jest.Mock).mock.results[0].value.release).not.toHaveBeenCalled();

    expect(cleanupCoverCache).not.toHaveBeenCalled();

    newerWrite.resolve(true);
    await waitFor(() => expect(setSpy).toHaveBeenCalledTimes(2));
    expect(cleanupCoverCache).not.toHaveBeenCalledWith(newerSongs);

    revertedWrite.resolve(true);
    await waitFor(() => expect(cleanupCoverCache).toHaveBeenCalledWith(songs));
    expect(cleanupCoverCache).not.toHaveBeenCalledWith(newerSongs);
    expect(setSpy).toHaveBeenNthCalledWith(1, StorageKeys.SONGS, newerSongs);
    expect(setSpy).toHaveBeenNthCalledWith(2, StorageKeys.SONGS, songs);
    expect((createCoverCacheProtection as jest.Mock).mock.results[0].value.release).toHaveBeenCalledTimes(1);
  });

  test('does not run cover cleanup or warn when songs persistence is dropped', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(musicPersistenceHelpers, 'persistIfChanged').mockResolvedValueOnce({ status: 'dropped' });

    render(<PersistedSongsProbe ready />);

    await waitFor(() => expect(musicPersistenceHelpers.persistIfChanged).toHaveBeenCalledTimes(1));
    expect(cleanupCoverCache).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalledWith('[usePersistedSongs] Persistence failed:', expect.anything());
    warn.mockRestore();
  });

  test('does not run cover cleanup when songs persistence is superseded', async () => {
    jest.spyOn(musicPersistenceHelpers, 'persistIfChanged').mockResolvedValueOnce({ status: 'superseded' });

    render(<PersistedSongsProbe ready />);

    await waitFor(() => expect(musicPersistenceHelpers.persistIfChanged).toHaveBeenCalledTimes(1));
    expect(cleanupCoverCache).not.toHaveBeenCalled();
    expect((createCoverCacheProtection as jest.Mock).mock.results[0].value.release).not.toHaveBeenCalled();
  });

  test('warns without cover cleanup when songs persistence fails', async () => {
    const error = new Error('persist failed');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(musicPersistenceHelpers, 'persistIfChanged').mockResolvedValueOnce({ status: 'failed', error });

    render(<PersistedSongsProbe ready />);

    await waitFor(() => expect(warn).toHaveBeenCalledWith('[usePersistedSongs] Persistence failed:', error));
    expect(cleanupCoverCache).not.toHaveBeenCalled();
    expect((createCoverCacheProtection as jest.Mock).mock.results[0].value.release).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  test('warns and keeps rendering when song persistence fails', async () => {
    const error = new Error('storage failed');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(musicPersistenceHelpers, 'prepareSongsForPersistence').mockRejectedValueOnce(error);

    const { getByTestId } = render(<PersistedSongsProbe ready />);

    expect(getByTestId('songs-count').props.children).toBe(1);
    await waitFor(() => {
      expect(warn).toHaveBeenCalledWith('[usePersistedSongs] Persistence failed:', error);
    });

    warn.mockRestore();
  });
});
