import React from 'react';
import { Button } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { useLibraryMetadataRefreshActions } from '../useLibraryMetadataRefreshActions';
import type { Song } from '../../types/Song';
import { getNoSongsMetadataAlert, getMetadataRefreshCompleteAlert } from '../../utils/libraryImportFlow';

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
    refreshSongsFromId3Impl,
    withTimeoutImpl,
  });

  return <Button title="refresh" onPress={() => void actions.refreshMetadataFromFiles()} />;
};

test('shows empty alert when there are no songs', async () => {
  const showAlert = jest.fn();
  const refreshSongsFromId3Impl = jest.fn();
  const screen = render(<HookHarness songs={[]} showAlert={showAlert} refreshSongsFromId3Impl={refreshSongsFromId3Impl} />);

  await act(async () => {
    await screen.getByText('refresh').props.onPress();
  });

  expect(showAlert).toHaveBeenCalledWith(getNoSongsMetadataAlert());
  expect(refreshSongsFromId3Impl).not.toHaveBeenCalled();
});

test('refreshes metadata, applies updated songs and shows completion alert', async () => {
  const setSongs = jest.fn();
  const showAlert = jest.fn();
  const refreshSongsFromId3Impl = jest.fn().mockResolvedValue({ songs: [song('updated')], updated: 1, skipped: 2, failed: 3 });
  const screen = render(
    <HookHarness songs={[song('old')]} setSongs={setSongs} showAlert={showAlert} refreshSongsFromId3Impl={refreshSongsFromId3Impl} />,
  );

  await act(async () => {
    await screen.getByText('refresh').props.onPress();
  });

  expect(refreshSongsFromId3Impl).toHaveBeenCalledWith([song('old')]);
  expect(setSongs).toHaveBeenCalledWith([song('updated')]);
  expect(showAlert).toHaveBeenCalledWith(getMetadataRefreshCompleteAlert(1, 2, 3));
});
