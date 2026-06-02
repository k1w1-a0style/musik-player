import React from 'react';
import { Button } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useLibraryImportActions } from '../useLibraryImportActions';
import type { ScanFolder } from '../../types/ScanFolder';
import type { Song } from '../../types/Song';
import {
  getEmptyScanImportAlert,
  getEmptyMediaLibraryImportAlert,
  getMediaLibraryPermissionDeniedAlert,
  getPartialScanImportAlert,
} from '../../utils/libraryImportFlow';
import { TimeoutError } from '../../utils/withTimeout';

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
  withTimeoutImpl?: <T>(operation: Promise<T> | ((signal: AbortSignal) => Promise<T>), timeoutMs: number, timeoutMessage: string, options?: { signal?: AbortSignal }) => Promise<T>;
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
  withTimeoutImpl = operation => (typeof operation === 'function' ? operation(new AbortController().signal) : operation),
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

afterEach(() => {
  jest.restoreAllMocks();
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

  await waitFor(() => expect(importSongsFromSourcesImpl).toHaveBeenCalledWith({ scanFolders: [folder('music')], platformOs: 'android', signal: expect.any(AbortSignal) }));
  expect(requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
  expect(persistChangedFolderUpdates).toHaveBeenCalledWith([folder('music')]);
  expect(setSongs).toHaveBeenCalledWith([song('existing'), song('scan-song')]);
  expect(setActiveTab).toHaveBeenCalledWith('tracks');
  expect(setMenuOpen).toHaveBeenCalledWith(false);
  expect(setLoading).toHaveBeenNthCalledWith(1, true);
  expect(setLoading).toHaveBeenLastCalledWith(false);
  expect(setImportStatus).toHaveBeenLastCalledWith(null);
});

test('scan folder import publishes preparing reading and found statuses', async () => {
  const importSongsFromSourcesImpl = jest.fn().mockResolvedValue({ songs: [song('scan-song')], errors: [], folderUpdates: undefined });
  const screen = render(
    <HookHarness
      scanFolders={[folder('music')]}
      importSongsFromSourcesImpl={importSongsFromSourcesImpl}
    />,
  );

  fireEvent.press(screen.getByText('import'));

  await waitFor(() => expect(setSongs).toHaveBeenCalledWith([song('scan-song')]));
  expect(setImportStatus).toHaveBeenCalledWith('Import wird vorbereitet…');
  expect(setImportStatus).toHaveBeenCalledWith('Scan-Ordner werden gelesen… (1)');
  expect(setImportStatus).toHaveBeenCalledWith('1 Tracks gefunden. Bibliothek wird aktualisiert…');
});

test('shows partial scan alert and still applies imported songs', async () => {
  const importSongsFromSourcesImpl = jest.fn().mockResolvedValue({ songs: [song('scan-song')], errors: ['content://missing'], folderUpdates: undefined });
  const screen = render(
    <HookHarness
      scanFolders={[folder('music')]}
      songs={[song('existing')]}
      importSongsFromSourcesImpl={importSongsFromSourcesImpl}
    />,
  );

  fireEvent.press(screen.getByText('import'));

  await waitFor(() => expect(showAlert).toHaveBeenCalledWith(getPartialScanImportAlert()));
  expect(setSongs).toHaveBeenCalledWith([song('existing'), song('scan-song')]);
  expect(setActiveTab).toHaveBeenCalledWith('tracks');
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

test('cancels stale overlapping import and lets the latest import finish', async () => {
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

  expect(importSongsFromSourcesImpl).toHaveBeenCalledTimes(2);
  resolveImport({ songs: [song('scan-song')], errors: [], folderUpdates: undefined });
  await waitFor(() => expect(setLoading).toHaveBeenLastCalledWith(false));
});

test('does not show stopped alert when a stale import is superseded', async () => {
  let resolveFirst: (value: { songs: Song[]; errors: never[]; folderUpdates: undefined }) => void = () => undefined;
  let resolveSecond: (value: { songs: Song[]; errors: never[]; folderUpdates: undefined }) => void = () => undefined;
  const firstImport = new Promise<{ songs: Song[]; errors: never[]; folderUpdates: undefined }>(resolve => {
    resolveFirst = resolve;
  });
  const secondImport = new Promise<{ songs: Song[]; errors: never[]; folderUpdates: undefined }>(resolve => {
    resolveSecond = resolve;
  });
  const importSongsFromSourcesImpl = jest.fn()
    .mockReturnValueOnce(firstImport)
    .mockReturnValueOnce(secondImport);
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const screen = render(
    <HookHarness
      scanFolders={[folder('music')]}
      importSongsFromSourcesImpl={importSongsFromSourcesImpl}
    />,
  );

  fireEvent.press(screen.getByText('import'));
  fireEvent.press(screen.getByText('import'));

  resolveFirst({ songs: [song('stale')], errors: [], folderUpdates: undefined });
  resolveSecond({ songs: [song('latest')], errors: [], folderUpdates: undefined });

  await waitFor(() => expect(setSongs).toHaveBeenCalledWith([song('latest')]));
  expect(setSongs).not.toHaveBeenCalledWith([song('stale')]);
  expect(showAlert).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Import gestoppt' }));
  expect(warnSpy).toHaveBeenCalledWith('[Import] Import cancelled.', expect.any(Error));
});

test('does not apply or persist stale scan import after timeout', async () => {
  let resolveImport: (value: { songs: Song[]; errors: never[]; folderUpdates: ScanFolder[] }) => void = () => undefined;
  const importPromise = new Promise<{ songs: Song[]; errors: never[]; folderUpdates: ScanFolder[] }>(resolve => {
    resolveImport = resolve;
  });
  const importSongsFromSourcesImpl = jest.fn().mockReturnValue(importPromise);
  const timeoutError = new TimeoutError('scan timed out');
  const withTimeoutImpl = async <T,>(operation: Promise<T> | ((signal: AbortSignal) => Promise<T>)): Promise<T> => {
    if (typeof operation === 'function') void operation(new AbortController().signal).catch(() => undefined);
    throw timeoutError;
  };
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const screen = render(
    <HookHarness
      scanFolders={[folder('music')]}
      songs={[song('existing')]}
      importSongsFromSourcesImpl={importSongsFromSourcesImpl}
      withTimeoutImpl={withTimeoutImpl}
    />,
  );

  fireEvent.press(screen.getByText('import'));

  await waitFor(() => expect(showAlert).toHaveBeenCalledWith({ title: 'Import gestoppt', message: 'scan timed out' }));
  resolveImport({ songs: [song('late')], errors: [], folderUpdates: [folder('late')] });
  await Promise.resolve();
  expect(setSongs).not.toHaveBeenCalled();
  expect(persistChangedFolderUpdates).not.toHaveBeenCalled();
  expect(warnSpy).toHaveBeenCalledWith('[Import] Import timed out.', timeoutError);
  expect(setLoading).toHaveBeenLastCalledWith(false);
  expect(setImportStatus).toHaveBeenLastCalledWith(null);
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
  expect(scanMediaLibraryCandidatesImpl).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) });
  expect(confirmLibraryImportImpl).toHaveBeenCalledWith(1, 0);
  expect(enrichMediaLibraryAssetsImpl).toHaveBeenCalledWith([{ id: 'asset-1' }], 0, { signal: expect.any(AbortSignal) });
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

test('shows empty media library alert without confirmation or enrichment', async () => {
  const scanMediaLibraryCandidatesImpl = jest.fn().mockResolvedValue({ assets: [], skipped: [] });
  const confirmLibraryImportImpl = jest.fn();
  const enrichMediaLibraryAssetsImpl = jest.fn();
  const screen = render(
    <HookHarness
      scanFolders={[]}
      scanMediaLibraryCandidatesImpl={scanMediaLibraryCandidatesImpl}
      confirmLibraryImportImpl={confirmLibraryImportImpl}
      enrichMediaLibraryAssetsImpl={enrichMediaLibraryAssetsImpl}
    />,
  );

  fireEvent.press(screen.getByText('import'));

  await waitFor(() => expect(showAlert).toHaveBeenCalledWith(getEmptyMediaLibraryImportAlert()));
  expect(confirmLibraryImportImpl).not.toHaveBeenCalled();
  expect(enrichMediaLibraryAssetsImpl).not.toHaveBeenCalled();
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
