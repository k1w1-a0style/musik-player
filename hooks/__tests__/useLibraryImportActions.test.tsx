import React from 'react';
import { Button } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { useLibraryImportActions } from '../useLibraryImportActions';
import type { ScanFolder } from '../../types/ScanFolder';
import type { Song } from '../../types/Song';

const folder = (id: string, enabled = true): ScanFolder => ({
  id,
  name: id,
  uri: `content://${id}`,
  addedAt: 1,
  enabled,
});

const song = (id: string): Song => ({
  id,
  title: id,
  artist: 'Artist',
  album: 'Album',
  uri: `file://${id}.mp3`,
});

interface HookHarnessProps {
  scanFolders?: ScanFolder[];
  songs?: Song[];
  platformOs?: string;
  importSongsFromSourcesImpl?: jest.Mock;
  requestMediaLibraryPermissionsAsync?: jest.Mock;
  scanMediaLibraryCandidatesImpl?: jest.Mock;
  enrichMediaLibraryAssetsImpl?: jest.Mock;
  confirmLibraryImportImpl?: jest.Mock;
  withTimeoutImpl?: <T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string) => Promise<T>;
}

const HookHarness = ({
  scanFolders = [],
  songs = [],
  platformOs = 'android',
  importSongsFromSourcesImpl = jest.fn().mockResolvedValue({ songs: [song('scan-song')], errors: [], folderUpdates: undefined }),
  requestMediaLibraryPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' }),
  scanMediaLibraryCandidatesImpl = jest.fn().mockResolvedValue({ assets: [{ id: 'asset-1' }], skipped: [] }),
  enrichMediaLibraryAssetsImpl = jest.fn().mockResolvedValue({ songs: [song('media-song')] }),
  confirmLibraryImportImpl = jest.fn().mockResolvedValue(true),
  withTimeoutImpl = promise => promise,
}: HookHarnessProps) => {
  const actions = useLibraryImportActions({
    scanFolders,
    songs,
    setSongs: jest.fn(),
    setActiveTab: jest.fn(),
    setMenuOpen: jest.fn(),
    setLoading: jest.fn(),
    setImportStatus: jest.fn(),
    showAlert: jest.fn(),
    persistChangedFolderUpdates: jest.fn().mockResolvedValue(undefined),
    platformOs,
    importSongsFromSourcesImpl,
    requestMediaLibraryPermissionsAsync,
    scanMediaLibraryCandidatesImpl,
    enrichMediaLibraryAssetsImpl,
    confirmLibraryImportImpl,
    withTimeoutImpl,
  });

  return <Button title="import" onPress={() => void actions.importFromDevice()} />;
};

test('uses scan folder import on android when active scan folders exist', async () => {
  const importSongsFromSourcesImpl = jest.fn().mockResolvedValue({ songs: [song('scan-song')], errors: [], folderUpdates: undefined });
  const requestMediaLibraryPermissionsAsync = jest.fn();
  const screen = render(
    <HookHarness
      scanFolders={[folder('music')]}
      importSongsFromSourcesImpl={importSongsFromSourcesImpl}
      requestMediaLibraryPermissionsAsync={requestMediaLibraryPermissionsAsync}
    />,
  );

  await act(async () => {
    await screen.getByText('import').props.onPress();
  });

  expect(importSongsFromSourcesImpl).toHaveBeenCalledWith({ scanFolders: [folder('music')], platformOs: 'android' });
  expect(requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
});

test('uses media library import when no active scan folders exist', async () => {
  const importSongsFromSourcesImpl = jest.fn();
  const requestMediaLibraryPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
  const screen = render(
    <HookHarness
      scanFolders={[folder('disabled', false)]}
      importSongsFromSourcesImpl={importSongsFromSourcesImpl}
      requestMediaLibraryPermissionsAsync={requestMediaLibraryPermissionsAsync}
    />,
  );

  await act(async () => {
    await screen.getByText('import').props.onPress();
  });

  expect(importSongsFromSourcesImpl).not.toHaveBeenCalled();
  expect(requestMediaLibraryPermissionsAsync).toHaveBeenCalledTimes(1);
});
