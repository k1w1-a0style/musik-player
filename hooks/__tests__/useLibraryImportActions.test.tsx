import React from 'react';
import { createSongLibraryState, type SongLibraryState } from '../../contexts/songLibraryState';
import { Button } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
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
import { prepareLibraryWaveforms } from '../../utils/libraryWaveformPreparation';

jest.mock('../../utils/libraryWaveformPreparation', () => ({
  clearWaveformPreparation: jest.fn(), prepareLibraryWaveforms: jest.fn().mockResolvedValue(undefined),
}));

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
  songImport?: SongLibraryState;
  platformOs?: string;
  importTimeoutMs?: number;
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
  songImport: providedSongImport,
  platformOs = 'android',
  importTimeoutMs,
  importSongsFromSourcesImpl = jest.fn().mockResolvedValue({ songs: [song('scan-song')], errors: [], folderUpdates: undefined }),
  requestMediaLibraryPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' }),
  scanMediaLibraryCandidatesImpl = jest.fn().mockResolvedValue({ assets: [{ id: 'asset-1' }], skipped: [] }),
  enrichMediaLibraryAssetsImpl = jest.fn().mockResolvedValue({ songs: [song('media-song')] }),
  confirmLibraryImportImpl = jest.fn().mockResolvedValue(true),
  withTimeoutImpl = operation => (typeof operation === 'function' ? operation(new AbortController().signal) : operation),
}: HookHarnessProps) => {
  const [ownedSongImport] = React.useState(() => {
    const state = createSongLibraryState(songs);
    state.configurePersistence(async read => read());
    return state;
  });
  const songImport = providedSongImport ?? ownedSongImport;
  songImport.configureImportPublication(next => { setSongs(next); songImport.setSongs(next); });
  const actions = useLibraryImportActions({
    scanFolders,
    songs, songImport,
    setSongs,
    setActiveTab,
    setMenuOpen,
    setLoading,
    setImportStatus,
    showAlert,
    persistChangedFolderUpdates,
    platformOs,
    importTimeoutMs,
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

  await waitFor(() => expect(importSongsFromSourcesImpl).toHaveBeenCalledWith({ scanFolders: [folder('music')],
    platformOs: 'android', signal: expect.any(AbortSignal), onSafProgress: expect.any(Function),
    existingSongs: [song('existing')], refreshExisting: false, onFileProgress: expect.any(Function), onCheckpoint: expect.any(Function),
    coverCacheProtection: expect.any(Object) }));
  expect(requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
  expect(persistChangedFolderUpdates).toHaveBeenCalledWith([folder('music')]);
  expect(setSongs).toHaveBeenCalledWith([song('existing'), song('scan-song')]);
  expect(prepareLibraryWaveforms).toHaveBeenCalledWith([song('scan-song')],
    { signal: expect.any(AbortSignal) });
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
  expect(setImportStatus).toHaveBeenCalledWith('1 Titel gefunden. Bibliothek wird aktualisiert…');
});

test('scan folder import publishes throttled SAF scan progress statuses', async () => {
  let now = 1_000;
  const dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
  const importSongsFromSourcesImpl = jest.fn(async ({ onSafProgress }) => {
    onSafProgress?.({ directoriesVisited: 1, filesFound: 0, errorsFound: 0, currentUri: 'content://music' });
    now = 1_100;
    onSafProgress?.({ directoriesVisited: 1, filesFound: 1, errorsFound: 0, currentUri: 'content://music/a.mp3' });
    now = 1_500;
    onSafProgress?.({ directoriesVisited: 2, filesFound: 2, errorsFound: 0, currentUri: 'content://music/b.mp3' });
    return { songs: [song('scan-song')], errors: [], folderUpdates: undefined };
  });
  const screen = render(
    <HookHarness
      scanFolders={[folder('music')]}
      importSongsFromSourcesImpl={importSongsFromSourcesImpl}
    />,
  );

  fireEvent.press(screen.getByText('import'));

  await waitFor(() => expect(setSongs).toHaveBeenCalledWith([song('scan-song')]));
  expect(setImportStatus).toHaveBeenCalledWith('Ordner wird auf neue oder geänderte Titel geprüft…');
  expect(setImportStatus).not.toHaveBeenCalledWith('Scan läuft… 1 Ordner gelesen, 1 Titel gefunden');
  expect(setImportStatus).toHaveBeenCalledWith('Scan läuft… 2 Ordner gelesen, 2 Titel gefunden');
  dateNowSpy.mockRestore();
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
  await waitFor(() => expect(importSongsFromSourcesImpl).toHaveBeenCalledTimes(1));
  fireEvent.press(screen.getByText('import'));

  await waitFor(() => expect(importSongsFromSourcesImpl).toHaveBeenCalledTimes(2));
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
  await waitFor(() => expect(importSongsFromSourcesImpl).toHaveBeenCalledTimes(1));
  fireEvent.press(screen.getByText('import'));
  await waitFor(() => expect(importSongsFromSourcesImpl).toHaveBeenCalledTimes(2));

  resolveFirst({ songs: [song('stale')], errors: [], folderUpdates: undefined });
  resolveSecond({ songs: [song('latest')], errors: [], folderUpdates: undefined });

  await waitFor(() => expect(setSongs).toHaveBeenCalledWith([song('latest')]));
  expect(setSongs).not.toHaveBeenCalledWith([song('stale')]);
  expect(showAlert).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Import gestoppt' }));
  expect(warnSpy).toHaveBeenCalledWith('[Import] Import cancelled.', expect.any(Error));
});

test.each(['saf', 'media'] as const)('a new %s import waits for the prior write and uses its hidden confirmed baseline', async source => {
  const initial = [song('existing')];
  const state = createSongLibraryState(initial);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  state.configurePersistence(async read => { await gate; return read(); });
  const pending = state.commitImport({ baselineSongs: initial, importedSongs: [song('hidden')], activeTab: 'tracks' },
    { controller: new AbortController() });
  const importSongsFromSourcesImpl = jest.fn().mockResolvedValue({ songs: [song('scan-song')], errors: [] });
  const enrichMediaLibraryAssetsImpl = jest.fn().mockResolvedValue({ songs: [song('media-song')] });
  const screen = render(<HookHarness songs={initial} songImport={state}
    scanFolders={source === 'saf' ? [folder('music')] : []}
    importSongsFromSourcesImpl={importSongsFromSourcesImpl} enrichMediaLibraryAssetsImpl={enrichMediaLibraryAssetsImpl} />);
  fireEvent.press(screen.getByText('import'));
  await act(async () => { await Promise.resolve(); });
  expect(importSongsFromSourcesImpl).not.toHaveBeenCalled();
  expect(enrichMediaLibraryAssetsImpl).not.toHaveBeenCalled();
  expect(setSongs).not.toHaveBeenCalled();
  await act(async () => { release(); await pending; });
  const expectedBaseline = [song('existing'), song('hidden')];
  if (source === 'saf') {
    await waitFor(() => expect(importSongsFromSourcesImpl).toHaveBeenCalledWith(expect.objectContaining({ existingSongs: expectedBaseline })));
  } else {
    await waitFor(() => expect(enrichMediaLibraryAssetsImpl).toHaveBeenCalledWith(expect.any(Array), 0,
      expect.objectContaining({ existingSongs: expectedBaseline })));
  }
  await waitFor(() => expect(setLoading).toHaveBeenLastCalledWith(false));
  expect(state.getCurrent()).toEqual(expect.arrayContaining(expectedBaseline));
});

test('a new import stops waiting for hung storage without releasing its real write lock', async () => {
  jest.useFakeTimers();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const state = createSongLibraryState();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  state.configurePersistence(async read => { await gate; return read(); });
  const pending = state.commitImport({ baselineSongs: [], importedSongs: [song('stored-later')], activeTab: 'tracks' },
    { controller: new AbortController() });
  const importSongsFromSourcesImpl = jest.fn();
  try {
    const screen = render(<HookHarness songImport={state} scanFolders={[folder('music')]}
      importTimeoutMs={10} importSongsFromSourcesImpl={importSongsFromSourcesImpl} />);
    fireEvent.press(screen.getByText('import'));
    await act(async () => { await jest.advanceTimersByTimeAsync(10); });
    expect(showAlert).toHaveBeenCalledWith(expect.objectContaining({ title: 'Import gestoppt',
      message: expect.stringContaining('Vorheriger Import speichert noch') }));
    expect(setLoading).toHaveBeenLastCalledWith(false);
    expect(importSongsFromSourcesImpl).not.toHaveBeenCalled();
    expect(state.getCurrent()).toEqual([]);
    await act(async () => { release(); await pending; });
    expect(state.getCurrent().map(song => song.id)).toEqual(['stored-later']);
    expect(setSongs).not.toHaveBeenCalled();
    expect(importSongsFromSourcesImpl).not.toHaveBeenCalled();
  } finally { release(); await pending; jest.useRealTimers(); }
});

test('does not apply or persist stale scan import after timeout', async () => {
  let resolveImport: (value: { songs: Song[]; errors: never[]; folderUpdates: ScanFolder[] }) => void = () => undefined;
  const importPromise = new Promise<{ songs: Song[]; errors: never[]; folderUpdates: ScanFolder[] }>(resolve => {
    resolveImport = resolve;
  });
  const importSongsFromSourcesImpl = jest.fn(({ onSafProgress }) => {
    onSafProgress?.({ directoriesVisited: 12, filesFound: 24, errorsFound: 1, currentUri: 'content://music' });
    return importPromise;
  });
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
  expect(warnSpy).toHaveBeenCalledWith('[Import] SAF scan progress before timeout.', { directoriesVisited: 12, filesFound: 24, errorsFound: 1, currentUri: 'content://music' });
  expect(warnSpy).toHaveBeenCalledWith('[Import] Import timed out.', timeoutError);
  expect(setLoading).toHaveBeenLastCalledWith(false);
  expect(setImportStatus).toHaveBeenLastCalledWith(null);
});

test('keeps an accepted batch when a scan stalls and rejects its late checkpoint', async () => {
  let lateCheckpoint: ((checkpoint: { songs: Song[]; processed: number; total: number }) => void) | undefined;
  const importSongsFromSourcesImpl = jest.fn(async ({ onCheckpoint }) => {
    lateCheckpoint = onCheckpoint;
    await onCheckpoint({ songs: [song('accepted')], processed: 1, total: 2 });
    throw new TimeoutError('scan stalled');
  });
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const screen = render(<HookHarness scanFolders={[folder('music')]} songs={[song('existing')]}
    importSongsFromSourcesImpl={importSongsFromSourcesImpl} />);
  fireEvent.press(screen.getByText('import'));
  await waitFor(() => expect(showAlert).toHaveBeenCalledWith({ title: 'Import gestoppt', message: 'scan stalled' }));
  expect(setSongs).toHaveBeenCalledWith([song('accepted'), song('existing')]);
  const acceptedCalls = setSongs.mock.calls.length;
  lateCheckpoint?.({ songs: [song('late')], processed: 2, total: 2 });
  expect(setSongs).toHaveBeenCalledTimes(acceptedCalls);
  expect(setLoading).toHaveBeenLastCalledWith(false);
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
  expect(scanMediaLibraryCandidatesImpl).toHaveBeenCalledWith({ signal: expect.any(AbortSignal), onProgress: expect.any(Function) });
  expect(confirmLibraryImportImpl).toHaveBeenCalledWith(1, 0);
  expect(enrichMediaLibraryAssetsImpl).toHaveBeenCalledWith([{ id: 'asset-1' }], 0,
    { signal: expect.any(AbortSignal), existingSongs: [song('existing')], refreshExisting: false,
      onFileProgress: expect.any(Function), onCheckpoint: expect.any(Function), coverCacheProtection: expect.any(Object) });
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
