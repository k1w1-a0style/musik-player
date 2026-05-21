import React from 'react';
import { Button } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useLibraryImportActions } from '../useLibraryImportActions';
import type { ScanFolder } from '../../types/ScanFolder';
import type { Song } from '../../types/Song';
import {
  getEmptyScanImportAlert,
  getMediaLibraryPermissionDeniedAlert,
} from '../../utils/libraryImportFlow';

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

const setSongs = jest.fn();
const setActiveTab = jest.fn();
const setMenuOpen = jest.fn();
const setLoading = jest.fn();
const setImportStatus = jest.fn();
const showAlert = jest.fn();
const persistChangedFolderUpdates = jest.fn();

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
    setSongs,
    setActiveTab,
    setMenuOpen,
    setLoading,
    setImportStatus,
    showAlert,
    persistChangedFolderUpdates,
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

beforeEach(() => {
  jest.clearAllMocks();
  persistChangedFolderUpdates.mockResolvedValue(undefined);
});

test('uses scan folder import on android when active scan folders exist', async () => {
  const importSongsFromSourcesImpl = jest.fn().mockResolvedValue({ songs: [song('scan-song')], errors: [], folderUpdates: [folder('music')] });
  const requestMediaLibraryPermissionsAsync = jest.fn();
  const screen = render(
    <HookHarness
      scanFolders={[folder('music')]}
      songs={[song('existing')]}
      importSongsFromSourcesImpl={importSongsFromSourcesImpl}
      requestMediaLibraryPermissionsAsync={requestMediaLibraryPermissionsAsync}
    />,
  );

  fireEvent.press(screen.getByText('import'));

  await waitFor(() => expect(importSongsFromSourcesImpl).toHaveBeenCalledWith({ scanFolders: [folder('music')], platformOs: 'android' }));
  expect(requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
  expect(persistChangedFolderUpdates).toHaveBeenCalledWith([folder('music')]);
  expect(setSongs).toHaveBeenCalledWith([song('existing'), song('scan-song')]);
  expect(setActiveTab).toHaveBeenCalledWith('tracks');
  expect(setMenuOpen).toHaveBeenCalledWith(false);
  expect(setLoading).toHaveBeenNthCalledWith(1, true);
  expect(setLoading).toHaveBeenLastCalledWith(false);
  expect(setImportStatus).toHaveBeenLastCalledWith(null);
});

test('keeps scan import results when folder update persistence rejects', async () => {
  const importSongsFromSourcesImpl = jest.fn().mockResolvedValue({
    songs: [song('scan-song')],
    errors: [],
    folderUpdates: [folder('music')],
  });
  persistChangedFolderUpdates.mockRejectedValueOnce(new Error('folder update rejected'));
  const screen = render(
    <HookHarness
      scanFolders={[folder('music')]}
      songs={[song('existing')]}
      importSongsFromSourcesImpl={importSongsFromSourcesImpl}
    />,
  );

  fireEvent.press(screen.getByText('import'));

  await waitFor(() => expect(setSongs).toHaveBeenCalledWith([song('existing'), song('scan-song')]));
  expect(showAlert).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Import gestoppt' }));
  expect(setLoading).toHaveBeenLastCalledWith(false);
  expect(setImportStatus).toHaveBeenLastCalledWith(null);
});

test('ignores overlapping import requests while one is running', async () => {
  let resolveImport: (value: { songs: Song[]; errors: never[]; folderUpdates: undefined }) => void = () => undefined;
  const importPromise = new Promise<{ songs: Song[]; errors: never[]; folderUpdates: undefined }>(resolve => {
    resolveImport = resolve;
  });
  const importSongsFromSourcesImpl = jest.fn().mockReturnValue(importPromise);
  const screen = render(
    <HookHarness
      scanFolders={[folder('music')]}
      importSongsFromSourcesImpl={importSongsFromSourcesImpl}
    />,
  );

  fireEvent.press(screen.getByText('import'));
  fireEvent.press(screen.getByText('import'));

  expect(importSongsFromSourcesImpl).toHaveBeenCalledTimes(1);
  resolveImport({ songs: [song('scan-song')], errors: [], folderUpdates: undefined });
  await waitFor(() => expect(setLoading).toHaveBeenLastCalledWith(false));
});

test('shows empty scan alert without applying song update', async () => {
  const importSongsFromSourcesImpl = jest.fn().mockResolvedValue({ songs: [], errors: [], folderUpdates: undefined });
  const screen = render(
    <HookHarness
      scanFolders={[folder('music')]}
      importSongsFromSourcesImpl={importSongsFromSourcesImpl}
    />,
  );

  fireEvent.press(screen.getByText('import'));

  await waitFor(() => expect(showAlert).toHaveBeenCalledWith(getEmptyScanImportAlert([])));
  expect(setSongs).not.toHaveBeenCalled();
  expect(setActiveTab).not.toHaveBeenCalled();
  expect(setLoading).toHaveBeenLastCalledWith(false);
  expect(setImportStatus).toHaveBeenLastCalledWith(null);
});

test('uses media library import when no active scan folders exist', async () => {
  const importSongsFromSourcesImpl = jest.fn();
  const requestMediaLibraryPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
  const scanMediaLibraryCandidatesImpl = jest.fn().mockResolvedValue({ assets: [{ id: 'asset-1' }], skipped: [] });
  const enrichMediaLibraryAssetsImpl = jest.fn().mockResolvedValue({ songs: [song('media-song')] });
  const confirmLibraryImportImpl = jest.fn().mockResolvedValue(true);
  const screen = render(
    <HookHarness
      scanFolders={[folder('disabled', false)]}
      songs={[song('existing')]}
      importSongsFromSourcesImpl={importSongsFromSourcesImpl}
      requestMediaLibraryPermissionsAsync={requestMediaLibraryPermissionsAsync}
      scanMediaLibraryCandidatesImpl={scanMediaLibraryCandidatesImpl}
      enrichMediaLibraryAssetsImpl={enrichMediaLibraryAssetsImpl}
      confirmLibraryImportImpl={confirmLibraryImportImpl}
    />,
  );

  fireEvent.press(screen.getByText('import'));

  await waitFor(() => expect(requestMediaLibraryPermissionsAsync).toHaveBeenCalledTimes(1));
  expect(importSongsFromSourcesImpl).not.toHaveBeenCalled();
  expect(scanMediaLibraryCandidatesImpl).toHaveBeenCalledTimes(1);
  expect(confirmLibraryImportImpl).toHaveBeenCalledWith(1, 0);
  expect(enrichMediaLibraryAssetsImpl).toHaveBeenCalledWith([{ id: 'asset-1' }], 0);
  expect(setSongs).toHaveBeenCalledWith([song('existing'), song('media-song')]);
  expect(setActiveTab).toHaveBeenCalledWith('tracks');
});

test('does not import media assets when permission is denied', async () => {
  const requestMediaLibraryPermissionsAsync = jest.fn().mockResolvedValue({ status: 'denied' });
  const scanMediaLibraryCandidatesImpl = jest.fn();
  const screen = render(
    <HookHarness
      scanFolders={[]}
      requestMediaLibraryPermissionsAsync={requestMediaLibraryPermissionsAsync}
      scanMediaLibraryCandidatesImpl={scanMediaLibraryCandidatesImpl}
    />,
  );

  fireEvent.press(screen.getByText('import'));

  await waitFor(() => expect(showAlert).toHaveBeenCalledWith(getMediaLibraryPermissionDeniedAlert()));
  expect(scanMediaLibraryCandidatesImpl).not.toHaveBeenCalled();
  expect(setSongs).not.toHaveBeenCalled();
});

test('skips media import when confirmation is declined', async () => {
  const confirmLibraryImportImpl = jest.fn().mockResolvedValue(false);
  const enrichMediaLibraryAssetsImpl = jest.fn();
  const screen = render(
    <HookHarness
      scanFolders={[]}
      confirmLibraryImportImpl={confirmLibraryImportImpl}
      enrichMediaLibraryAssetsImpl={enrichMediaLibraryAssetsImpl}
    />,
  );

  fireEvent.press(screen.getByText('import'));

  await waitFor(() => expect(confirmLibraryImportImpl).toHaveBeenCalledWith(1, 0));
  expect(enrichMediaLibraryAssetsImpl).not.toHaveBeenCalled();
  expect(setSongs).not.toHaveBeenCalled();
});

test('shows stopped alert and clears loading when import throws', async () => {
  const importSongsFromSourcesImpl = jest.fn().mockRejectedValue(new Error('kaputt'));
  const screen = render(
    <HookHarness
      scanFolders={[folder('music')]}
      importSongsFromSourcesImpl={importSongsFromSourcesImpl}
    />,
  );

  fireEvent.press(screen.getByText('import'));

  await waitFor(() => expect(showAlert).toHaveBeenCalledWith({
    title: 'Import gestoppt',
    message: 'kaputt',
  }));
  expect(setLoading).toHaveBeenLastCalledWith(false);
  expect(setImportStatus).toHaveBeenLastCalledWith(null);
});
