import React from 'react';
import { Button, View } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useLibraryMetadataRefreshActions } from '../useLibraryMetadataRefreshActions';
import type { Song } from '../../types/Song';
import {
  getMetadataRefreshCompleteAlert,
  getMetadataUpdateStoppedAlert,
  getMetadataRefreshFlowCopy,
  getNoSongsMetadataAlert,
  getMetadataRefreshPartialAlert,
} from '../../utils/libraryImportFlow';
import { OperationAbortError, TimeoutError } from '../../utils/withTimeout';
import { MetadataRefreshPartialError } from '../../utils/songMetadataRefresh';

const song = (id: string, title = id): Song => ({
  id,
  title,
  artist: 'Artist',
  album: 'Album',
  uri: `file://${id}.mp3`,
});

const songs = (count: number): Song[] =>
  Array.from({ length: count }, (_, index) => song(`s${index + 1}`));

type TestSongProcessedCallback = (partial: {
  index: number;
  song: Song;
  patch?: Partial<Song>;
  updatedDelta: number;
  skippedDelta: number;
  failedDelta: number;
  errorUri?: string;
}) => void;

interface HookHarnessProps {
  songs?: Song[];
  setSongs?: jest.Mock;
  setMenuOpen?: jest.Mock;
  setLoading?: jest.Mock;
  setImportStatus?: jest.Mock;
  showAlert?: jest.Mock;
  refreshSongsFromId3Impl?: jest.Mock;
  withTimeoutImpl?: <T>(operation: Promise<T> | ((signal: AbortSignal) => Promise<T>), timeoutMs: number, timeoutMessage: string, options?: { signal?: AbortSignal }) => Promise<T>;
  applySongMetadataPatches?: jest.Mock;
  onRefreshRequest?: (request: Promise<void>) => void;
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
  applySongMetadataPatches,
  onRefreshRequest,
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
    applySongMetadataPatches,
  });

  return (
    <View>
      <Button title="refresh" onPress={() => {
        const request = actions.refreshMetadataFromFiles();
        onRefreshRequest?.(request);
      }} />
      <Button title="cancel" onPress={() => actions.cancelRefresh()} />
    </View>
  );
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

  await waitFor(() => expect(refreshSongsFromId3Impl).toHaveBeenCalledWith([song('old')], expect.objectContaining({ signal: expect.any(AbortSignal), onProgress: expect.any(Function), concurrency: 2 })));
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

test('ignores a rapid second manual refresh while the first is active', async () => {
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

  expect(refreshSongsFromId3Impl).toHaveBeenCalledTimes(1);
  expect(setLoading).toHaveBeenCalledWith(true);
  resolveRefresh({ songs: [song('updated', 'Fresh')], updated: 1, skipped: 0, failed: 0, errors: [] });
  await waitFor(() => expect(setLoading).toHaveBeenLastCalledWith(false));
  expect(warnSpy).not.toHaveBeenCalledWith('[LibraryRefresh] Metadata refresh cancelled.', expect.any(Error));
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

test('cancels an active refresh before starting another without applying stale state or stopped alert', async () => {
  let markFirstStarted!: () => void;
  const firstStarted = new Promise<void>(resolve => {
    markFirstStarted = resolve;
  });
  let markFirstAborted!: () => void;
  const firstAborted = new Promise<void>(resolve => {
    markFirstAborted = resolve;
  });
  let resolveLatestRefresh: (value: { songs: Song[]; updated: number; skipped: number; failed: number; errors: never[] }) => void = () => undefined;
  const latestRefreshPromise = new Promise<{ songs: Song[]; updated: number; skipped: number; failed: number; errors: never[] }>(resolve => {
    resolveLatestRefresh = resolve;
  });
  const refreshSongsFromId3Impl = jest
    .fn()
    .mockImplementationOnce((_songs: Song[], options?: { signal?: AbortSignal }) => {
      markFirstStarted();
      const signal = options?.signal;
      return new Promise<never>((_resolve, reject) => {
        const handleAbort = () => {
          signal?.removeEventListener('abort', handleAbort);
          markFirstAborted();
          reject(signal?.reason ?? new OperationAbortError('Metadata refresh cancelled'));
        };
        if (signal?.aborted) handleAbort();
        else signal?.addEventListener('abort', handleAbort, { once: true });
      });
    })
    .mockReturnValueOnce(latestRefreshPromise);
  const setSongs = jest.fn();
  const setLoading = jest.fn();
  const setImportStatus = jest.fn();
  const showAlert = jest.fn();
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const withTimeoutImpl = <T,>(operation: Promise<T> | ((signal: AbortSignal) => Promise<T>), _timeoutMs: number, _timeoutMessage: string, options?: { signal?: AbortSignal }): Promise<T> => {
    const signal = options?.signal ?? new AbortController().signal;
    return typeof operation === 'function' ? operation(signal) : operation;
  };
  const refreshRequests: Promise<void>[] = [];
  const screen = render(
    <HookHarness
      songs={[song('old')]}
      setSongs={setSongs}
      setLoading={setLoading}
      setImportStatus={setImportStatus}
      showAlert={showAlert}
      refreshSongsFromId3Impl={refreshSongsFromId3Impl}
      withTimeoutImpl={withTimeoutImpl}
      onRefreshRequest={request => refreshRequests.push(request)}
    />,
  );

  fireEvent.press(screen.getByText('refresh'));
  await firstStarted;
  fireEvent.press(screen.getByText('cancel'));

  await firstAborted;
  await refreshRequests[0];
  expect(warnSpy).toHaveBeenCalledWith('[LibraryRefresh] Metadata refresh cancelled.', expect.any(Error));
  expect(setLoading).toHaveBeenLastCalledWith(false);
  expect(setImportStatus).toHaveBeenLastCalledWith(null);
  fireEvent.press(screen.getByText('refresh'));

  resolveLatestRefresh({ songs: [song('latest', 'Latest')], updated: 1, skipped: 0, failed: 0, errors: [] });
  await refreshRequests[1];

  await waitFor(() => expect(setSongs).toHaveBeenCalledWith([song('latest', 'Latest')]));
  expect(showAlert).toHaveBeenCalledTimes(1);
  expect(showAlert).toHaveBeenCalledWith(getMetadataRefreshCompleteAlert(1, 0, 0));
  expect(showAlert).not.toHaveBeenCalledWith(getMetadataUpdateStoppedAlert(expect.any(Error)));
  expect(setLoading).toHaveBeenLastCalledWith(false);
  expect(setImportStatus).toHaveBeenLastCalledWith(null);
});


test('applies partial progress before timeout and shows continuation alert', async () => {
  const applySongMetadataPatches = jest.fn();
  const showAlert = jest.fn();
  const partialResult = {
    songs: [song('s1', 'Fresh'), song('s2')],
    updated: 1,
    skipped: 1,
    failed: 0,
    errors: [],
    patchesBySongId: { s1: { title: 'Fresh' } },
    processed: 2,
    total: 3,
    completed: false,
    timedOut: true,
    lastProcessedSongId: 's2',
  };
  const refreshSongsFromId3Impl = jest.fn().mockRejectedValue(
    new MetadataRefreshPartialError('timed out', partialResult, new TimeoutError('timed out')),
  );
  const screen = render(
    <HookHarness
      songs={[song('s1'), song('s2'), song('s3')]}
      showAlert={showAlert}
      refreshSongsFromId3Impl={refreshSongsFromId3Impl}
      applySongMetadataPatches={applySongMetadataPatches}
    />,
  );

  fireEvent.press(screen.getByText('refresh'));

  await waitFor(() => expect(applySongMetadataPatches).toHaveBeenCalledWith({ s1: { title: 'Fresh' } }));
  expect(showAlert).toHaveBeenCalledWith(getMetadataRefreshPartialAlert(2, 3));
});

test('preserves active first chunk progress when timeout wins the race and resumes after it', async () => {
  const librarySongs = songs(30);
  const applySongMetadataPatches = jest.fn();
  const showAlert = jest.fn();
  const timeoutError = new TimeoutError('timed out');
  const refreshSongsFromId3Impl = jest
    .fn()
    .mockImplementationOnce((chunk: Song[], options?: { onSongProcessed?: TestSongProcessedCallback }) => {
      chunk.slice(0, 10).forEach((processedSong, index) => {
        options?.onSongProcessed?.({
          index,
          song: { ...processedSong, title: `Fresh ${index + 1}` },
          patch: { title: `Fresh ${index + 1}` },
          updatedDelta: 1,
          skippedDelta: 0,
          failedDelta: 0,
        });
      });
      return new Promise(() => undefined);
    })
    .mockResolvedValue({
      songs: librarySongs.slice(10),
      updated: 0,
      skipped: 20,
      failed: 0,
      errors: [],
      patchesBySongId: {},
      processed: 20,
      total: 30,
      completed: true,
    });
  const withTimeoutImpl = jest
    .fn()
    .mockImplementationOnce(async <T,>(operation: Promise<T> | ((signal: AbortSignal) => Promise<T>)): Promise<T> => {
      if (typeof operation === 'function') void operation(new AbortController().signal).catch(() => undefined);
      throw timeoutError;
    })
    .mockImplementation(async <T,>(operation: Promise<T> | ((signal: AbortSignal) => Promise<T>)): Promise<T> => (
      typeof operation === 'function' ? operation(new AbortController().signal) : operation
    ));
  const screen = render(
    <HookHarness
      songs={librarySongs}
      showAlert={showAlert}
      refreshSongsFromId3Impl={refreshSongsFromId3Impl}
      withTimeoutImpl={withTimeoutImpl}
      applySongMetadataPatches={applySongMetadataPatches}
    />,
  );

  fireEvent.press(screen.getByText('refresh'));

  await waitFor(() => expect(applySongMetadataPatches).toHaveBeenCalledWith(
    Object.fromEntries(librarySongs.slice(0, 10).map((processedSong, index) => [processedSong.id, { title: `Fresh ${index + 1}` }])),
  ));
  expect(showAlert).toHaveBeenCalledWith(getMetadataRefreshPartialAlert(10, 30));

  fireEvent.press(screen.getByText('refresh'));

  await waitFor(() => expect(refreshSongsFromId3Impl).toHaveBeenCalledTimes(2));
  expect(refreshSongsFromId3Impl.mock.calls[1][0].map((processedSong: Song) => processedSong.id).slice(0, 3)).toEqual(['s11', 's12', 's13']);
});


test('does not advance resume past gaps when parallel partial progress completes a later song first', async () => {
  const librarySongs = songs(3);
  const applySongMetadataPatches = jest.fn();
  const showAlert = jest.fn();
  const timeoutError = new TimeoutError('timed out');
  const refreshSongsFromId3Impl = jest
    .fn()
    .mockImplementationOnce((chunk: Song[], options?: { onSongProcessed?: TestSongProcessedCallback }) => {
      options?.onSongProcessed?.({
        index: 1,
        song: { ...chunk[1], title: 'Fresh s2' },
        patch: { title: 'Fresh s2' },
        updatedDelta: 1,
        skippedDelta: 0,
        failedDelta: 0,
      });
      return new Promise(() => undefined);
    })
    .mockResolvedValue({
      songs: librarySongs,
      updated: 0,
      skipped: 3,
      failed: 0,
      errors: [],
      patchesBySongId: {},
      processed: 3,
      processedIndexes: [0, 1, 2],
      total: 3,
      completed: true,
    });
  const withTimeoutImpl = jest
    .fn()
    .mockImplementationOnce(async <T,>(operation: Promise<T> | ((signal: AbortSignal) => Promise<T>)): Promise<T> => {
      if (typeof operation === 'function') void operation(new AbortController().signal).catch(() => undefined);
      throw timeoutError;
    })
    .mockImplementation(async <T,>(operation: Promise<T> | ((signal: AbortSignal) => Promise<T>)): Promise<T> => (
      typeof operation === 'function' ? operation(new AbortController().signal) : operation
    ));
  const screen = render(
    <HookHarness
      songs={librarySongs}
      showAlert={showAlert}
      refreshSongsFromId3Impl={refreshSongsFromId3Impl}
      withTimeoutImpl={withTimeoutImpl}
      applySongMetadataPatches={applySongMetadataPatches}
    />,
  );

  fireEvent.press(screen.getByText('refresh'));

  await waitFor(() => expect(applySongMetadataPatches).toHaveBeenCalledWith({ s2: { title: 'Fresh s2' } }));
  expect(showAlert).toHaveBeenCalledWith(getMetadataRefreshPartialAlert(1, 3));
  expect(showAlert).not.toHaveBeenCalledWith(getMetadataRefreshCompleteAlert(expect.any(Number), expect.any(Number), expect.any(Number)));

  fireEvent.press(screen.getByText('refresh'));

  await waitFor(() => expect(refreshSongsFromId3Impl).toHaveBeenCalledTimes(2));
  expect(refreshSongsFromId3Impl.mock.calls[1][0].map((processedSong: Song) => processedSong.id)).toEqual(['s1', 's2', 's3']);
});

test('does not commit resume progress when applying a partial result fails', async () => {
  const librarySongs = songs(30);
  const applyError = new Error('apply failed');
  const applySongMetadataPatches = jest.fn()
    .mockImplementationOnce(() => {
      throw applyError;
    })
    .mockImplementation(() => undefined);
  const showAlert = jest.fn();
  const timeoutError = new TimeoutError('timed out');
  const refreshSongsFromId3Impl = jest.fn().mockImplementation((chunk: Song[], options?: { onSongProcessed?: TestSongProcessedCallback }) => {
    chunk.slice(0, 10).forEach((processedSong, index) => {
      options?.onSongProcessed?.({
        index,
        song: { ...processedSong, title: `Fresh ${processedSong.id}` },
        patch: { title: `Fresh ${processedSong.id}` },
        updatedDelta: 1,
        skippedDelta: 0,
        failedDelta: 0,
      });
    });
    return new Promise(() => undefined);
  });
  const withTimeoutImpl = async <T,>(operation: Promise<T> | ((signal: AbortSignal) => Promise<T>)): Promise<T> => {
    if (typeof operation === 'function') void operation(new AbortController().signal).catch(() => undefined);
    throw timeoutError;
  };
  const screen = render(
    <HookHarness
      songs={librarySongs}
      showAlert={showAlert}
      refreshSongsFromId3Impl={refreshSongsFromId3Impl}
      withTimeoutImpl={withTimeoutImpl}
      applySongMetadataPatches={applySongMetadataPatches}
    />,
  );

  fireEvent.press(screen.getByText('refresh'));

  await waitFor(() => expect(showAlert).toHaveBeenCalledWith(getMetadataUpdateStoppedAlert(applyError)));

  fireEvent.press(screen.getByText('refresh'));

  await waitFor(() => expect(refreshSongsFromId3Impl).toHaveBeenCalledTimes(2));
  expect(refreshSongsFromId3Impl.mock.calls[1][0].map((processedSong: Song) => processedSong.id).slice(0, 3)).toEqual(['s1', 's2', 's3']);
});

test('fallback setSongs keeps original library order after resumed refresh', async () => {
  const librarySongs = songs(30);
  const setSongs = jest.fn();
  const showAlert = jest.fn();
  const timeoutError = new TimeoutError('timed out');
  const refreshSongsFromId3Impl = jest
    .fn()
    .mockImplementationOnce((chunk: Song[], options?: { onSongProcessed?: TestSongProcessedCallback }) => {
      chunk.slice(0, 10).forEach((processedSong, index) => {
        options?.onSongProcessed?.({
          index,
          song: processedSong,
          updatedDelta: 0,
          skippedDelta: 1,
          failedDelta: 0,
        });
      });
      return new Promise(() => undefined);
    })
    .mockImplementation((chunk: Song[]) => Promise.resolve({
      songs: chunk.map(processedSong => (
        processedSong.id === 's11' ? { ...processedSong, title: 'Fresh s11' } : processedSong
      )),
      updated: chunk.some(processedSong => processedSong.id === 's11') ? 1 : 0,
      skipped: chunk.filter(processedSong => processedSong.id !== 's11').length,
      failed: 0,
      errors: [],
      patchesBySongId: chunk.some(processedSong => processedSong.id === 's11') ? { s11: { title: 'Fresh s11' } } : {},
      processed: chunk.length,
      total: chunk.length,
      completed: true,
    }));
  const withTimeoutImpl = jest
    .fn()
    .mockImplementationOnce(async <T,>(operation: Promise<T> | ((signal: AbortSignal) => Promise<T>)): Promise<T> => {
      if (typeof operation === 'function') void operation(new AbortController().signal).catch(() => undefined);
      throw timeoutError;
    })
    .mockImplementation(async <T,>(operation: Promise<T> | ((signal: AbortSignal) => Promise<T>)): Promise<T> => (
      typeof operation === 'function' ? operation(new AbortController().signal) : operation
    ));
  const screen = render(
    <HookHarness
      songs={librarySongs}
      setSongs={setSongs}
      showAlert={showAlert}
      refreshSongsFromId3Impl={refreshSongsFromId3Impl}
      withTimeoutImpl={withTimeoutImpl}
    />,
  );

  fireEvent.press(screen.getByText('refresh'));

  await waitFor(() => expect(showAlert).toHaveBeenCalledWith(getMetadataRefreshPartialAlert(10, 30)));
  expect(setSongs).not.toHaveBeenCalled();

  fireEvent.press(screen.getByText('refresh'));

  await waitFor(() => expect(setSongs).toHaveBeenCalled());
  const appliedSongs = setSongs.mock.calls[0][0] as Song[];
  expect(appliedSongs.map(appliedSong => appliedSong.id)).toEqual(librarySongs.map(appliedSong => appliedSong.id));
  expect(appliedSongs[10].title).toBe('Fresh s11');
  expect(showAlert).toHaveBeenCalledWith(getMetadataRefreshCompleteAlert(1, 29, 0));
});

test('multiple partial timeouts eventually complete when resume index wraps', async () => {
  const librarySongs = songs(30);
  const showAlert = jest.fn();
  const timeoutError = new TimeoutError('timed out');
  const refreshSongsFromId3Impl = jest.fn().mockImplementation((chunk: Song[], options?: { onSongProcessed?: TestSongProcessedCallback }) => {
    chunk.slice(0, 10).forEach((processedSong, index) => {
      options?.onSongProcessed?.({
        index,
        song: processedSong,
        updatedDelta: 0,
        skippedDelta: 1,
        failedDelta: 0,
      });
    });
    return new Promise(() => undefined);
  });
  const withTimeoutImpl = async <T,>(operation: Promise<T> | ((signal: AbortSignal) => Promise<T>)): Promise<T> => {
    if (typeof operation === 'function') void operation(new AbortController().signal).catch(() => undefined);
    throw timeoutError;
  };
  const screen = render(
    <HookHarness
      songs={librarySongs}
      showAlert={showAlert}
      refreshSongsFromId3Impl={refreshSongsFromId3Impl}
      withTimeoutImpl={withTimeoutImpl}
    />,
  );

  fireEvent.press(screen.getByText('refresh'));
  await waitFor(() => expect(showAlert).toHaveBeenCalledWith(getMetadataRefreshPartialAlert(10, 30)));
  expect(refreshSongsFromId3Impl.mock.calls[0][0].map((processedSong: Song) => processedSong.id).slice(0, 2)).toEqual(['s1', 's2']);

  fireEvent.press(screen.getByText('refresh'));
  await waitFor(() => expect(showAlert).toHaveBeenCalledWith(getMetadataRefreshPartialAlert(10, 30)));
  expect(refreshSongsFromId3Impl.mock.calls[1][0].map((processedSong: Song) => processedSong.id).slice(0, 2)).toEqual(['s11', 's12']);

  fireEvent.press(screen.getByText('refresh'));
  await waitFor(() => expect(showAlert).toHaveBeenCalledWith(getMetadataRefreshCompleteAlert(0, 10, 0)));
  expect(refreshSongsFromId3Impl.mock.calls[2][0].map((processedSong: Song) => processedSong.id).slice(0, 2)).toEqual(['s21', 's22']);
  expect(showAlert).not.toHaveBeenCalledWith(getMetadataRefreshPartialAlert(30, 30));
});

test('preserves later chunk in-flight progress without double-counting completed chunks', async () => {
  const librarySongs = songs(40);
  const applySongMetadataPatches = jest.fn();
  const showAlert = jest.fn();
  const timeoutError = new TimeoutError('timed out');
  const completedChunkPatches = Object.fromEntries(librarySongs.slice(0, 25).map(processedSong => [processedSong.id, { title: `Done ${processedSong.id}` }]));
  const activeChunkPatches = Object.fromEntries(librarySongs.slice(25, 32).map(processedSong => [processedSong.id, { title: `Partial ${processedSong.id}` }]));
  const refreshSongsFromId3Impl = jest
    .fn()
    .mockResolvedValueOnce({
      songs: librarySongs.slice(0, 25).map(processedSong => ({ ...processedSong, title: `Done ${processedSong.id}` })),
      updated: 25,
      skipped: 0,
      failed: 0,
      errors: [],
      patchesBySongId: completedChunkPatches,
      processed: 25,
      total: 25,
      completed: true,
    })
    .mockImplementationOnce((chunk: Song[], options?: { onSongProcessed?: TestSongProcessedCallback }) => {
      chunk.slice(0, 7).forEach((processedSong, index) => {
        options?.onSongProcessed?.({
          index,
          song: { ...processedSong, title: `Partial ${processedSong.id}` },
          patch: { title: `Partial ${processedSong.id}` },
          updatedDelta: 1,
          skippedDelta: 0,
          failedDelta: 0,
        });
      });
      return new Promise(() => undefined);
    });
  const withTimeoutImpl = jest
    .fn()
    .mockImplementationOnce(async <T,>(operation: Promise<T> | ((signal: AbortSignal) => Promise<T>)): Promise<T> => (
      typeof operation === 'function' ? operation(new AbortController().signal) : operation
    ))
    .mockImplementationOnce(async <T,>(operation: Promise<T> | ((signal: AbortSignal) => Promise<T>)): Promise<T> => {
      if (typeof operation === 'function') void operation(new AbortController().signal).catch(() => undefined);
      throw timeoutError;
    });
  const screen = render(
    <HookHarness
      songs={librarySongs}
      showAlert={showAlert}
      refreshSongsFromId3Impl={refreshSongsFromId3Impl}
      withTimeoutImpl={withTimeoutImpl}
      applySongMetadataPatches={applySongMetadataPatches}
    />,
  );

  fireEvent.press(screen.getByText('refresh'));

  await waitFor(() => expect(applySongMetadataPatches).toHaveBeenCalledWith({
    ...completedChunkPatches,
    ...activeChunkPatches,
  }));
  expect(showAlert).toHaveBeenCalledWith(getMetadataRefreshPartialAlert(32, 40));
});

test('normal successful chunk uses chunk result once instead of double-merging callback progress', async () => {
  const setSongs = jest.fn();
  const showAlert = jest.fn();
  const refreshSongsFromId3Impl = jest.fn().mockImplementation((chunk: Song[], options?: { onSongProcessed?: TestSongProcessedCallback }) => {
    const updatedSong = { ...chunk[0], title: 'Fresh once' };
    options?.onSongProcessed?.({
      index: 0,
      song: updatedSong,
      patch: { title: 'Fresh once' },
      updatedDelta: 1,
      skippedDelta: 0,
      failedDelta: 0,
    });
    return Promise.resolve({
      songs: [updatedSong],
      updated: 1,
      skipped: 0,
      failed: 0,
      errors: [],
      patchesBySongId: { s1: { title: 'Fresh once' } },
      processed: 1,
      total: 1,
      completed: true,
    });
  });
  const screen = render(
    <HookHarness
      songs={[song('s1')]}
      setSongs={setSongs}
      showAlert={showAlert}
      refreshSongsFromId3Impl={refreshSongsFromId3Impl}
    />,
  );

  fireEvent.press(screen.getByText('refresh'));

  await waitFor(() => expect(showAlert).toHaveBeenCalledWith(getMetadataRefreshCompleteAlert(1, 0, 0)));
  expect(showAlert).not.toHaveBeenCalledWith(getMetadataRefreshCompleteAlert(2, 0, 0));
  expect(setSongs).toHaveBeenCalledWith([{ ...song('s1'), title: 'Fresh once' }]);
});

test('timeout with zero processed keeps stopped message', async () => {
  const showAlert = jest.fn();
  const timeoutError = new TimeoutError('timed out');
  const withTimeoutImpl = async <T,>(): Promise<T> => { throw timeoutError; };
  const screen = render(
    <HookHarness
      songs={[song('s1')]}
      showAlert={showAlert}
      withTimeoutImpl={withTimeoutImpl}
    />,
  );

  fireEvent.press(screen.getByText('refresh'));

  await waitFor(() => expect(showAlert).toHaveBeenCalledWith(getMetadataUpdateStoppedAlert(timeoutError)));
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

  await waitFor(() => expect(refreshSongsFromId3Impl).toHaveBeenCalledWith([song('old')], expect.objectContaining({ signal: observedSignals[0], onProgress: expect.any(Function) })));
  expect(observedSignals).toHaveLength(1);
});
