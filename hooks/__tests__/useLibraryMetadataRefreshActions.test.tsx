import React from 'react';
import { Button } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useLibraryMetadataRefreshActions } from '../useLibraryMetadataRefreshActions';
import type { Song } from '../../types/Song';
import {
  getMetadataRefreshCompleteAlert,
  getMetadataUpdateStoppedAlert,
  getNoSongsMetadataAlert,
} from '../../utils/libraryImportFlow';

const song = (id: string): Song => ({
  id,
  title: id,
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
  withTimeoutImpl?: <T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string) => Promise<T>;
}

const HookHarness = ({
  songs = [],
  setSongs = jest.fn(),
  setMenuOpen = jest.fn(),
  setLoading = jest.fn(),
  setImportStatus = jest.fn(),
  showAlert = jest.fn(),
  refreshSongsFromId3Impl = jest.fn().mockResolvedValue({ songs: [song('updated')], updated: 1, skipped: 0, failed: 0 }),
  withTimeoutImpl = promise => promise,
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

test('shows empty alert when there are no songs', async () => {
  const showAlert = jest.fn();
  const refreshSongsFromId3Impl = jest.fn();
  const setMenuOpen = jest.fn();
  const setLoading = jest.fn();
  const screen = render(
    <HookHarness
      songs={[]}
      setMenuOpen={setMenuOpen}
      setLoading={setLoading}
      showAlert={showAlert}
      refreshSongsFromId3Impl={refreshSongsFromId3Impl}
    />,
  );

  fireEvent.press(screen.getByText('refresh'));

  await waitFor(() => expect(showAlert).toHaveBeenCalledWith(getNoSongsMetadataAlert()));
  expect(refreshSongsFromId3Impl).not.toHaveBeenCalled();
  expect(setMenuOpen).toHaveBeenCalledWith(false);
  expect(setLoading).not.toHaveBeenCalledWith(true);
});

test('refreshes metadata, applies updated songs and shows completion alert', async () => {
  const setSongs = jest.fn();
  const setMenuOpen = jest.fn();
  const setLoading = jest.fn();
  const setImportStatus = jest.fn();
  const showAlert = jest.fn();
  const refreshSongsFromId3Impl = jest.fn().mockResolvedValue({ songs: [song('updated')], updated: 1, skipped: 2, failed: 3 });
  const withTimeoutCalls = jest.fn();
  const withTimeoutImpl = <T,>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
    withTimeoutCalls(promise, timeoutMs, timeoutMessage);
    return promise;
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

  await waitFor(() => expect(refreshSongsFromId3Impl).toHaveBeenCalledWith([song('old')]));
  expect(withTimeoutCalls).toHaveBeenCalledWith(expect.any(Promise), 100, expect.any(String));
  expect(setSongs).toHaveBeenCalledWith([song('updated')]);
  expect(showAlert).toHaveBeenCalledWith(getMetadataRefreshCompleteAlert(1, 2, 3));
  expect(setMenuOpen).toHaveBeenCalledWith(false);
  expect(setLoading).toHaveBeenNthCalledWith(1, true);
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

test('shows stopped alert and clears loading when refresh throws', async () => {
  const setSongs = jest.fn();
  const setLoading = jest.fn();
  const setImportStatus = jest.fn();
  const showAlert = jest.fn();
  const error = new Error('kaputt');
  const refreshSongsFromId3Impl = jest.fn().mockRejectedValue(error);
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
  expect(setLoading).toHaveBeenLastCalledWith(false);
  expect(setImportStatus).toHaveBeenLastCalledWith(null);
});