import React from 'react';
import { Button } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useLibraryMetadataRefreshActions } from '../useLibraryMetadataRefreshActions';
import type { Song } from '../../types/Song';
import {
  getMetadataRefreshCompleteAlert,
  getMetadataUpdateStoppedAlert,
  getMetadataRefreshFlowCopy,
  getNoSongsMetadataAlert,
} from '../../utils/libraryImportFlow';
import { OperationAbortError, TimeoutError } from '../../utils/withTimeout';

const song = (id: string, title = id): Song => ({
  id,
  title,
  artist: 'Artist',
  album: 'Album',
  uri: `file://${id}.mp3`,
});

interface HookHarnessProps {
  songs?: Song[];
  setSongs?: jest.Mock;
  setMenuOpen?: jest.Mock;
  setLoading?: jest.Mock;
  setImportStatus?: jest.Mock;
  showAlert?: jest.Mock;
  refreshSongsFromId3Impl?: jest.Mock;
  withTimeoutImpl?: <T>(operation: Promise<T> | ((signal: AbortSignal) => Promise<T>), timeoutMs: number, timeoutMessage: string, options?: { signal?: AbortSignal }) => Promise<T>;
}

const HookHarness = ({
  songs = [],
  setSongs = jest.fn(),
  setMenuOpen = jest.fn(),
  setLoading = jest.fn(),
  setImportStatus = jest.fn(),
  showAlert = jest.fn(),
  refreshSongsFromId3Impl = jest.fn().mockResolvedValue({ songs: [song('updated')], updated: 1, skipped: 0, failed: 0 }),
  withTimeoutImpl = operation => (typeof operation === 'function' ? operation(new AbortController().signal) : operation),
}: HookHarnessProps) => {
  const actions = useLibraryMetadataRefreshActions({
    songs,
    setSongs,
    setMenuOpen,
    setLoading,
    setImportStatus,
    showAlert,
    importTimeoutMs: 100,
    refreshSongsFromId3Impl,
    withTimeoutImpl,
  });

  return <Button title="refresh" onPress={() => void actions.refreshMetadataFromFiles()} />;
};

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('shows empty alert when there are no songs', async () => {
  const showAlert = jest.fn();
  const refreshSongsFromId3Impl = jest.fn();
  const setMenuOpen = jest.fn();
  const setLoading = jest.fn();
  const setImportStatus = jest.fn();
  const screen = render(
    <HookHarness
      songs={[]}
      setMenuOpen={setMenuOpen}
      setLoading={setLoading}
      setImportStatus={setImportStatus}
      showAlert={showAlert}
      refreshSongsFromId3Impl={refreshSongsFromId3Impl}
    />,
  );

  fireEvent.press(screen.getByText('refresh'));

  await waitFor(() => expect(showAlert).toHaveBeenCalledWith(getNoSongsMetadataAlert()));
  expect(refreshSongsFromId3Impl).not.toHaveBeenCalled();
  expect(setMenuOpen).toHaveBeenCalledWith(false);
  expect(setLoading).not.toHaveBeenCalledWith(true);
  expect(setImportStatus).not.toHaveBeenCalled();
});

test('refreshes metadata, applies updated songs and shows completion alert', async () => {
  const setSongs = jest.fn();
  const setMenuOpen = jest.fn();
  const setLoading = jest.fn();
  const setImportStatus = jest.fn();
  const showAlert = jest.fn();
  const refreshSongsFromId3Impl = jest.fn().mockResolvedValue({ songs: [song('updated', 'Fresh')], updated: 1, skipped: 2, failed: 3 });
  const withTimeoutCalls = jest.fn();
  const withTimeoutImpl = <T,>(operation: Promise<T> | ((signal: AbortSignal) => Promise<T>), timeoutMs: number, timeoutMessage: string): Promise<T> => {
    withTimeoutCalls(operation, timeoutMs, timeoutMessage);
    return typeof operation === 'function' ? operation(new AbortController().signal) : operation;
  };
  const screen = render(
    <HookHarness
      songs={[song('old')]}
      setSongs={setSongs}
      setMenuOpen={setMenuOpen}
      setLoading={setLoading}
      setImportStatus={setImportStatus}
      showAlert={showAlert}
      refreshSongsFromId3Impl={refreshSongsFromId3Impl}
      withTimeoutImpl={withTimeoutImpl}
    />,
  );

  fireEvent.press(screen.getByText('refresh'));

  await waitFor(() => expect(refreshSongsFromId3Impl).toHaveBeenCalledWith([song('old')], { signal: expect.any(AbortSignal) }));
  const refreshCopy = getMetadataRefreshFlowCopy();
  expect(withTimeoutCalls).toHaveBeenCalledWith(expect.any(Function), 100, refreshCopy.timeoutMessage);
  expect(setSongs).toHaveBeenCalledWith([song('updated', 'Fresh')]);
  expect(showAlert).toHaveBeenCalledWith(getMetadataRefreshCompleteAlert(1, 2, 3));
  expect(setMenuOpen).toHaveBeenCalledWith(false);
  expect(setLoading).toHaveBeenNthCalledWith(1, true);
  expect(setImportStatus).toHaveBeenCalledWith(refreshCopy.readingStatus);
  expect(setLoading).toHaveBeenLastCalledWith(false);
  expect(setImportStatus).toHaveBeenLastCalledWith(null);
});

test('does not apply songs when refresh updated count is zero', async () => {
  const setSongs = jest.fn();
  const setLoading = jest.fn();
  const setImportStatus = jest.fn();
  const showAlert = jest.fn();
  const refreshSongsFromId3Impl = jest.fn().mockResolvedValue({ songs: [song('same')], updated: 0, skipped: 1, failed: 0 });
  const screen = render(
    <HookHarness
      songs={[song('old')]}
      setSongs={setSongs}
      setLoading={setLoading}
      setImportStatus={setImportStatus}
      showAlert={showAlert}
      refreshSongsFromId3Impl={refreshSongsFromId3Impl}
    />,
  );

  fireEvent.press(screen.getByText('refresh'));

  await waitFor(() => expect(showAlert).toHaveBeenCalledWith(getMetadataRefreshCompleteAlert(0, 1, 0)));
  expect(setSongs).not.toHaveBeenCalled();
  expect(setLoading).toHaveBeenLastCalledWith(false);
  expect(setImportStatus).toHaveBeenLastCalledWith(null);
});

test('cancels stale overlapping refresh and lets the latest refresh win', async () => {
  let resolveRefresh: (value: { songs: Song[]; updated: number; skipped: number; failed: number; errors: never[] }) => void = () => undefined;
  const refreshPromise = new Promise<{ songs: Song[]; updated: number; skipped: number; failed: number; errors: never[] }>(resolve => {
    resolveRefresh = resolve;
  });
  const refreshSongsFromId3Impl = jest.fn().mockReturnValue(refreshPromise);
  const setLoading = jest.fn();
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const screen = render(
    <HookHarness
      songs={[song('old')]}
      setLoading={setLoading}
      refreshSongsFromId3Impl={refreshSongsFromId3Impl}
    />,
  );

  fireEvent.press(screen.getByText('refresh'));
  fireEvent.press(screen.getByText('refresh'));

  expect(refreshSongsFromId3Impl).toHaveBeenCalledTimes(2);
  resolveRefresh({ songs: [song('updated', 'Fresh')], updated: 1, skipped: 0, failed: 0, errors: [] });
  await waitFor(() => expect(setLoading).toHaveBeenLastCalledWith(false));
  expect(warnSpy).toHaveBeenCalledWith('[LibraryRefresh] Metadata refresh cancelled.', expect.any(Error));
});

test('does not apply stale metadata refresh result after timeout', async () => {
  let resolveRefresh: (value: { songs: Song[]; updated: number; skipped: number; failed: number; errors: never[] }) => void = () => undefined;
  const refreshPromise = new Promise<{ songs: Song[]; updated: number; skipped: number; failed: number; errors: never[] }>(resolve => {
    resolveRefresh = resolve;
  });
  const refreshSongsFromId3Impl = jest.fn().mockReturnValue(refreshPromise);
  const setSongs = jest.fn();
  const setLoading = jest.fn();
  const setImportStatus = jest.fn();
  const showAlert = jest.fn();
  const timeoutError = new TimeoutError('refresh timed out');
  const withTimeoutImpl = async <T,>(operation: Promise<T> | ((signal: AbortSignal) => Promise<T>)): Promise<T> => {
    if (typeof operation === 'function') void operation(new AbortController().signal).catch(() => undefined);
    throw timeoutError;
  };
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const screen = render(
    <HookHarness
      songs={[song('old')]}
      setSongs={setSongs}
      setLoading={setLoading}
      setImportStatus={setImportStatus}
      showAlert={showAlert}
      refreshSongsFromId3Impl={refreshSongsFromId3Impl}
      withTimeoutImpl={withTimeoutImpl}
    />,
  );

  fireEvent.press(screen.getByText('refresh'));

  await waitFor(() => expect(showAlert).toHaveBeenCalledWith(getMetadataUpdateStoppedAlert(timeoutError)));
  resolveRefresh({ songs: [song('late', 'Late')], updated: 1, skipped: 0, failed: 0, errors: [] });
  await Promise.resolve();
  expect(setSongs).not.toHaveBeenCalled();
  expect(warnSpy).toHaveBeenCalledWith('[LibraryRefresh] Metadata refresh timed out.', timeoutError);
  expect(setLoading).toHaveBeenLastCalledWith(false);
  expect(setImportStatus).toHaveBeenLastCalledWith(null);
});

test('shows stopped alert and clears loading when refresh throws', async () => {
  const setSongs = jest.fn();
  const setLoading = jest.fn();
  const setImportStatus = jest.fn();
  const showAlert = jest.fn();
  const error = new Error('kaputt');
  const refreshSongsFromId3Impl = jest.fn().mockRejectedValue(error);
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const screen = render(
    <HookHarness
      songs={[song('old')]}
      setSongs={setSongs}
      setLoading={setLoading}
      setImportStatus={setImportStatus}
      showAlert={showAlert}
      refreshSongsFromId3Impl={refreshSongsFromId3Impl}
    />,
  );

  fireEvent.press(screen.getByText('refresh'));

  await waitFor(() => expect(showAlert).toHaveBeenCalledWith(getMetadataUpdateStoppedAlert(error)));
  expect(setSongs).not.toHaveBeenCalled();
  expect(warnSpy).toHaveBeenCalledWith('[LibraryRefresh] Metadata refresh failed.', error);
  expect(setLoading).toHaveBeenLastCalledWith(false);
  expect(setImportStatus).toHaveBeenLastCalledWith(null);
});

test('cancels stale overlapping refresh without applying stale state or stopped alert', async () => {
  let resolveLatestRefresh: (value: { songs: Song[]; updated: number; skipped: number; failed: number; errors: never[] }) => void = () => undefined;
  const latestRefreshPromise = new Promise<{ songs: Song[]; updated: number; skipped: number; failed: number; errors: never[] }>(resolve => {
    resolveLatestRefresh = resolve;
  });
  const refreshSongsFromId3Impl = jest
    .fn()
    .mockReturnValueOnce(new Promise(() => undefined))
    .mockReturnValueOnce(latestRefreshPromise);
  const setSongs = jest.fn();
  const setLoading = jest.fn();
  const setImportStatus = jest.fn();
  const showAlert = jest.fn();
  const abortError = new OperationAbortError('Metadata refresh superseded by a newer refresh');
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const withTimeoutImpl = <T,>(operation: Promise<T> | ((signal: AbortSignal) => Promise<T>), _timeoutMs: number, _timeoutMessage: string, options?: { signal?: AbortSignal }): Promise<T> => {
    const signal = options?.signal ?? new AbortController().signal;
    const operationPromise = typeof operation === 'function' ? operation(signal) : operation;
    const abortPromise = new Promise<never>((_, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason ?? abortError), { once: true });
    });
    return Promise.race([operationPromise, abortPromise]);
  };
  const screen = render(
    <HookHarness
      songs={[song('old')]}
      setSongs={setSongs}
      setLoading={setLoading}
      setImportStatus={setImportStatus}
      showAlert={showAlert}
      refreshSongsFromId3Impl={refreshSongsFromId3Impl}
      withTimeoutImpl={withTimeoutImpl}
    />,
  );

  fireEvent.press(screen.getByText('refresh'));
  fireEvent.press(screen.getByText('refresh'));

  await waitFor(() => expect(warnSpy).toHaveBeenCalledWith('[LibraryRefresh] Metadata refresh cancelled.', expect.any(Error)));
  expect(setLoading).not.toHaveBeenCalledWith(false);
  expect(setImportStatus).not.toHaveBeenCalledWith(null);

  resolveLatestRefresh({ songs: [song('latest', 'Latest')], updated: 1, skipped: 0, failed: 0, errors: [] });

  await waitFor(() => expect(setSongs).toHaveBeenCalledWith([song('latest', 'Latest')]));
  expect(showAlert).toHaveBeenCalledTimes(1);
  expect(showAlert).toHaveBeenCalledWith(getMetadataRefreshCompleteAlert(1, 0, 0));
  expect(showAlert).not.toHaveBeenCalledWith(getMetadataUpdateStoppedAlert(expect.any(Error)));
  expect(setLoading).toHaveBeenLastCalledWith(false);
  expect(setImportStatus).toHaveBeenLastCalledWith(null);
});

test('passes the active refresh signal to the injected timeout runner', async () => {
  const observedSignals: AbortSignal[] = [];
  const refreshSongsFromId3Impl = jest.fn().mockResolvedValue({ songs: [song('updated')], updated: 1, skipped: 0, failed: 0 });
  const withTimeoutImpl = <T,>(operation: Promise<T> | ((signal: AbortSignal) => Promise<T>), _timeoutMs: number, _timeoutMessage: string, options?: { signal?: AbortSignal }): Promise<T> => {
    if (options?.signal) observedSignals.push(options.signal);
    return typeof operation === 'function' ? operation(options?.signal ?? new AbortController().signal) : operation;
  };
  const screen = render(
    <HookHarness
      songs={[song('old')]}
      refreshSongsFromId3Impl={refreshSongsFromId3Impl}
      withTimeoutImpl={withTimeoutImpl}
    />,
  );

  fireEvent.press(screen.getByText('refresh'));

  await waitFor(() => expect(refreshSongsFromId3Impl).toHaveBeenCalledWith([song('old')], { signal: observedSignals[0] }));
  expect(observedSignals).toHaveLength(1);
});
