import React from 'react';
import { createSongLibraryState, type SongLibraryState } from '../../contexts/songLibraryState';
import { Button } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useLibraryImportActions } from '../useLibraryImportActions';
import type { ScanFolder } from '../../types/ScanFolder';
import type { Song } from '../../types/Song';
import {
      getMediaLibraryPermissionDeniedAlert,
} from '../../utils/libraryImportFlow';
import { TimeoutError, withTimeout } from '../../utils/withTimeout';
import { prepareLibraryWaveforms, hasPendingWaveformPreparation } from '../../utils/libraryWaveformPreparation';
import { isMetadataRefreshActive, resetMetadataRefreshActivityForTests } from '../../utils/metadataRefreshActivity';
import { getLibraryScanOperation } from '../../utils/libraryScanOperation';
import LibraryPreparationStatus from '../../components/LibraryPreparationStatus';

jest.mock('../../utils/libraryWaveformPreparation', () => ({
  clearWaveformPreparation: jest.fn(), prepareLibraryWaveforms: jest.fn().mockResolvedValue(undefined),
  hasPendingWaveformPreparation: jest.fn(() => false),
  useWaveformPreparation: () => ({ status: 'idle', failed: 0 }),
}));
jest.mock('../../contexts/AppThemeContext', () => ({ useAppTheme: () => ({ theme: { palette: {
  primary: '#eee', surfaceGlass: '#222', border: '#333', text: { primary: '#fff', secondary: '#ccc' } } } }) }));

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
  source?: import('../../utils/libraryScanSources').LibraryScanSource;
  fullScan?: boolean;
  showScanSummary?: boolean;
  scanFolders?: ScanFolder[];
  songs?: Song[];
  songImport?: SongLibraryState;
  platformOs?: string;
  importTimeoutMs?: number;
  importSongsFromSourcesImpl?: jest.Mock;
  requestMediaLibraryPermissionsAsync?: jest.Mock;
  getMediaLibraryPermissionsAsync?: jest.Mock;
  onSelectMusicFolder?: () => void;
  scanMediaLibraryCandidatesImpl?: jest.Mock;
  enrichMediaLibraryAssetsImpl?: jest.Mock;
  confirmLibraryImportImpl?: jest.Mock;
  withTimeoutImpl?: <T>(operation: Promise<T> | ((signal: AbortSignal) => Promise<T>), timeoutMs: number, timeoutMessage: string, options?: { signal?: AbortSignal }) => Promise<T>;
}

const HookHarness = ({
  source,
  fullScan = false,
  showScanSummary = false,
  scanFolders = [],
  songs = [],
  songImport: providedSongImport,
  platformOs = 'android',
  importTimeoutMs,
  importSongsFromSourcesImpl = jest.fn().mockResolvedValue({ songs: [song('scan-song')], errors: [], folderUpdates: undefined }),
  requestMediaLibraryPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' }),
  getMediaLibraryPermissionsAsync = jest.fn().mockResolvedValueOnce({ status: 'undetermined', canAskAgain: true })
    .mockResolvedValue({ status: 'granted' }),
  onSelectMusicFolder,
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
    getMediaLibraryPermissionsAsync,
    onSelectMusicFolder,
    scanMediaLibraryCandidatesImpl,
    enrichMediaLibraryAssetsImpl,
    confirmLibraryImportImpl,
    withTimeoutImpl,
  });

  return <>
    <Button title="import" onPress={() => void actions.importFromDevice({ refreshExisting: fullScan, source: source ?? (scanFolders.some(folder => folder.enabled) ? 'folders' : 'media-library') })} />
    <Button title="cancel import" onPress={() => actions.cancelImport()} />
    {showScanSummary ? <LibraryPreparationStatus visible={false} onRetryScan={() => {
      void actions.importFromDevice({ refreshExisting: getLibraryScanOperation().fullScan });
    }} /> : null}
  </>;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(hasPendingWaveformPreparation).mockReturnValue(false);
  resetMetadataRefreshActivityForTests();
  persistChangedFolderUpdates.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test.each([false, true])('retains a concrete library write error after the alert closes and retries the same mode (full: %s)', async fullScan => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const state = createSongLibraryState([]);
  const persist = jest.fn().mockRejectedValueOnce(new Error('Speicher voll: Bibliothek nicht bestätigt'))
    .mockImplementation(async read => read());
  state.configurePersistence(persist);
  const scan = jest.fn().mockResolvedValue({ songs: [song('retry-song')], errors: [] });
  const screen = render(<HookHarness fullScan={fullScan} showScanSummary songImport={state}
    scanFolders={[folder('music')]} importSongsFromSourcesImpl={scan} />);
  fireEvent.press(screen.getByText('import'));
  await waitFor(() => expect(showAlert).toHaveBeenCalledWith(expect.objectContaining({ message: 'Speicher voll: Bibliothek nicht bestätigt' })));
  showAlert.mockClear();
  expect(getLibraryScanOperation()).toMatchObject({ status: 'failed', fullScan,
    errorMessage: 'Speicher voll: Bibliothek nicht bestätigt' });
  fireEvent.press(screen.getByLabelText('Verarbeitungsdetails öffnen'));
  expect(screen.getByTestId('library-scan-summary-error').props.children).toBe('Speicher voll: Bibliothek nicht bestätigt');
  jest.useFakeTimers(); act(() => jest.advanceTimersByTime(10000)); jest.useRealTimers();
  expect(screen.getByText('Speicher voll: Bibliothek nicht bestätigt')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Scan erneut versuchen'));
  await waitFor(() => expect(scan).toHaveBeenCalledTimes(2));
  expect(scan).toHaveBeenLastCalledWith(expect.objectContaining({ refreshExisting: fullScan }));
  await waitFor(() => expect(persist).toHaveBeenCalledTimes(2));
  expect(getLibraryScanOperation().errorMessage).toBeUndefined();
});

test('user cancellation stops a stalled scan immediately and rejects late checkpoints and results', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  let resolveScan!: (result: { songs: Song[]; errors: string[] }) => void;
  let scanOptions!: Parameters<typeof import('../../utils/mediaLibraryImport').importSongsFromSources>[0];
  const state = createSongLibraryState([song('existing')]);
  state.configurePersistence(async read => read());
  const importSongsFromSourcesImpl = jest.fn().mockImplementationOnce(async options => {
    scanOptions = options;
    await options.onCheckpoint({ songs: [song('confirmed')], processed: 1, total: 3 });
    return new Promise(resolve => { resolveScan = resolve; });
  }).mockResolvedValueOnce({ songs: [song('new-scan')], errors: [] });
  const screen = render(<HookHarness scanFolders={[folder('music')]} songs={[song('existing')]}
    songImport={state} importSongsFromSourcesImpl={importSongsFromSourcesImpl} withTimeoutImpl={withTimeout} />);

  fireEvent.press(screen.getByText('import'));
  await waitFor(() => expect(setSongs).toHaveBeenCalledWith([song('confirmed'), song('existing')]));
  fireEvent.press(screen.getByText('cancel import'));
  expect(setLoading).toHaveBeenLastCalledWith(false);
  expect(setImportStatus).toHaveBeenLastCalledWith(null);
  await waitFor(() => expect(scanOptions?.signal?.aborted).toBe(true));
  await act(async () => {
    await scanOptions?.onCheckpoint?.({ songs: [song('late-checkpoint')], processed: 2, total: 3 });
  });

  fireEvent.press(screen.getByText('import'));
  await waitFor(() => expect(state.getCurrent().map(item => item.id).sort()).toEqual(['confirmed', 'existing', 'new-scan']));
  await act(async () => { resolveScan({ songs: [song('late-result')], errors: [] }); });
  expect(state.getCurrent().map(item => item.id).sort()).toEqual(['confirmed', 'existing', 'new-scan']);
  expect(showAlert).not.toHaveBeenCalled();
  expect(persistChangedFolderUpdates).toHaveBeenCalledTimes(1);
});

test('user cancellation retains the real storage barrier before a following scan', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  let resolveWrite!: () => void;
  const writing = new Promise<void>(resolve => { resolveWrite = resolve; });
  const state = createSongLibraryState([]);
  const persist = jest.fn().mockImplementationOnce(async (read: () => Song[]) => {
    const snapshot = read();
    await writing;
    return snapshot;
  }).mockImplementation(async (read: () => Song[]) => read());
  state.configurePersistence(persist);
  const importSongsFromSourcesImpl = jest.fn().mockImplementationOnce(async options => {
    await options.onCheckpoint({ songs: [song('stored-after-cancel')], processed: 1, total: 1 });
    return { songs: [song('stored-after-cancel')], errors: [] };
  }).mockResolvedValueOnce({ songs: [song('next-scan')], errors: [] });
  const screen = render(<HookHarness scanFolders={[folder('music')]} songImport={state}
    importSongsFromSourcesImpl={importSongsFromSourcesImpl} withTimeoutImpl={withTimeout} />);

  fireEvent.press(screen.getByText('import'));
  await waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
  fireEvent.press(screen.getByText('cancel import'));
  expect(setLoading).toHaveBeenLastCalledWith(false);
  fireEvent.press(screen.getByText('import'));
  await act(async () => { await Promise.resolve(); });
  expect(importSongsFromSourcesImpl).toHaveBeenCalledTimes(1);
  expect(setLoading).toHaveBeenLastCalledWith(true);

  await act(async () => { resolveWrite(); });
  await waitFor(() => expect(importSongsFromSourcesImpl).toHaveBeenCalledTimes(2));
  expect(importSongsFromSourcesImpl.mock.calls[1][0].existingSongs.map((item: Song) => item.id))
    .toEqual(['stored-after-cancel']);
  await waitFor(() => expect(setLoading).toHaveBeenLastCalledWith(false));
  expect(state.getCurrent().map(item => item.id).sort()).toEqual(['next-scan', 'stored-after-cancel']);
  expect(setSongs).toHaveBeenLastCalledWith([song('next-scan'), song('stored-after-cancel')]);
  expect(showAlert).not.toHaveBeenCalled();
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
  expect(prepareLibraryWaveforms).toHaveBeenCalledWith([song('scan-song')]);
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

test('partially completed folder scans show persistent diagnostics without an interrupting alert', async () => {
  const incomplete = jest.fn().mockResolvedValue({
    songs: [song('scan-song')], errors: ['content://timeout'], completed: false, remainingCount: 3,
    folderUpdates: [], statistics: { newCount: 1, changedCount: 0, unchangedCount: 0,
      unverifiedCount: 0, errorCount: 1 },
  });
  const screen = render(<HookHarness showScanSummary scanFolders={[folder('music')]}
    importSongsFromSourcesImpl={incomplete} />);
  fireEvent.press(screen.getByText('import'));
  await waitFor(() => expect(getLibraryScanOperation().status).toBe('partial'));
  expect(showAlert).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Verarbeitungsdetails öffnen'));
  expect(screen.getByText('Aktualisierung – teilweise abgeschlossen')).toBeTruthy();
  expect(screen.getByText('3 Datei(en) noch nicht geprüft')).toBeTruthy();
});

test('retains partial scan diagnostics and applies imported songs without a native dialog', async () => {
  const importSongsFromSourcesImpl = jest.fn().mockResolvedValue({ songs: [song('scan-song')], errors: ['content://missing'], completed: false, remainingCount: 1,
    statistics: { newCount: 1, changedCount: 0, unchangedCount: 0, unverifiedCount: 0, duplicateCount: 0, errorCount: 1 }, folderUpdates: undefined });
  const screen = render(
    <HookHarness
      showScanSummary scanFolders={[folder('music')]}
      songs={[song('existing')]}
      importSongsFromSourcesImpl={importSongsFromSourcesImpl}
    />,
  );

  fireEvent.press(screen.getByText('import'));

  await waitFor(() => expect(getLibraryScanOperation().status).toBe('partial'));
  expect(showAlert).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Verarbeitungsdetails öffnen'));
  expect(screen.getByText('0 ungeprüft · 1 Leseprobleme')).toBeTruthy();
  expect(screen.getByText('1 Datei(en) noch nicht geprüft')).toBeTruthy();
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

test.each([false, true])('a stalled folder write reports partial success while retaining the write barrier (empty result: %s)', async empty => {
  jest.useFakeTimers();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  let release!: () => void;
  persistChangedFolderUpdates.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
  const importSongsFromSourcesImpl = jest.fn().mockResolvedValue({
    songs: empty ? [] : [song('accepted')], errors: [], folderUpdates: [folder('music')],
  });
  const screen = render(<HookHarness scanFolders={[folder('music')]} importTimeoutMs={100}
    importSongsFromSourcesImpl={importSongsFromSourcesImpl} withTimeoutImpl={withTimeout} />);
  try {
    fireEvent.press(screen.getByText('import'));
    await act(async () => { await jest.advanceTimersByTimeAsync(101); });
    const stalled = { loading: setLoading.mock.calls.at(-1)?.[0], busy: isMetadataRefreshActive(),
      scan: getLibraryScanOperation().status };
    await act(async () => { release(); await jest.advanceTimersByTimeAsync(1); });
    expect(stalled).toEqual({ loading: false, busy: false, scan: 'partial' });
    expect(showAlert).toHaveBeenCalledWith(expect.objectContaining({ title: 'Bibliothek gespeichert – Ordnerdaten fehlen' }));
  } finally { screen.unmount(); jest.useRealTimers(); }
});

test('a timed-out final library write retains its real barrier and never publishes a false success', async () => {
  jest.useFakeTimers();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  let release!: () => void;
  const rawWrite = new Promise<void>(resolve => { release = resolve; });
  const state = createSongLibraryState([]);
  state.configurePersistence(async read => { const snapshot = read(); await rawWrite; return snapshot; });
  const importSongsFromSourcesImpl = jest.fn().mockResolvedValue({ songs: [song('late-durable')], errors: [] });
  const screen = render(<HookHarness scanFolders={[folder('music')]} songImport={state}
    importTimeoutMs={100} importSongsFromSourcesImpl={importSongsFromSourcesImpl} withTimeoutImpl={withTimeout} />);
  try {
    fireEvent.press(screen.getByText('import'));
    await act(async () => { await jest.advanceTimersByTimeAsync(101); });
    expect(setLoading).toHaveBeenLastCalledWith(false);
    expect(setSongs).not.toHaveBeenCalled();
    expect(isMetadataRefreshActive()).toBe(false);
    fireEvent.press(screen.getByText('import'));
    await act(async () => { await jest.advanceTimersByTimeAsync(0); });
    expect(importSongsFromSourcesImpl).toHaveBeenCalledTimes(1);
    await act(async () => { release(); await jest.advanceTimersByTimeAsync(1); });
    expect(importSongsFromSourcesImpl).toHaveBeenCalledTimes(2);
    expect(importSongsFromSourcesImpl.mock.calls[1][0].existingSongs).toEqual([song('late-durable')]);
  } finally { release(); screen.unmount(); jest.useRealTimers(); }
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

test('keeps an empty source nonblocking without applying a song update', async () => {
  const importSongsFromSourcesImpl = jest.fn().mockResolvedValue({ songs: [], errors: [], folderUpdates: undefined });
  const screen = render(
    <HookHarness
      scanFolders={[folder('music')]}
      importSongsFromSourcesImpl={importSongsFromSourcesImpl}
    />,
  );

  fireEvent.press(screen.getByText('import'));

  await waitFor(() => expect(setLoading).toHaveBeenLastCalledWith(false));
  expect(showAlert).not.toHaveBeenCalled();
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
  expect(confirmLibraryImportImpl).not.toHaveBeenCalled();
  expect(enrichMediaLibraryAssetsImpl).toHaveBeenCalledWith([{ id: 'asset-1' }], 0,
    { signal: expect.any(AbortSignal), existingSongs: [song('existing')], refreshExisting: false,
      onFileProgress: expect.any(Function), onCheckpoint: expect.any(Function), coverCacheProtection: expect.any(Object) });
  expect(setSongs).toHaveBeenCalledWith([song('existing'), song('media-song')]);
  expect(setActiveTab).toHaveBeenCalledWith('tracks');
});

test.each([false, true])('explains a native MEDIA_LIBRARY rejection and retains saved data (full: %s)', async fullScan => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const existing = song('saved-before-permission-failure');
  const state = createSongLibraryState([existing]);
  const persist = jest.fn(async (read: () => Song[]) => read());
  state.configurePersistence(persist);
  const scan = jest.fn().mockRejectedValue(new Error(
    "Call to function 'ExpoMediaLibrary.getAssetsAsync' has been rejected. → Caused by: Missing MEDIA_LIBRARY permissions."));
  const screen = render(<HookHarness fullScan={fullScan} songs={[existing]} songImport={state}
    scanMediaLibraryCandidatesImpl={scan} />);
  fireEvent.press(screen.getByText('import'));
  await waitFor(() => expect(setLoading).toHaveBeenLastCalledWith(false));
  expect(showAlert).not.toHaveBeenCalled();
  expect(getLibraryScanOperation().errorMessage).toContain('Musik');
  expect(JSON.stringify(showAlert.mock.calls)).not.toContain('ExpoMediaLibrary');
  expect(state.getCurrent()).toEqual([existing]);
  expect(persist).not.toHaveBeenCalled();
  expect(persistChangedFolderUpdates).not.toHaveBeenCalled();
  expect(getLibraryScanOperation()).toMatchObject({ status: 'failed', fullScan });
  expect(scan).toHaveBeenCalledTimes(1);
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

  await waitFor(() => expect(showAlert).toHaveBeenCalledWith(expect.objectContaining(getMediaLibraryPermissionDeniedAlert())));
  expect(scanMediaLibraryCandidatesImpl).not.toHaveBeenCalled();
  expect(setSongs).not.toHaveBeenCalled();
  expect(getLibraryScanOperation().status).toBe('failed');
});

test.each([false, true])('does not scan or save after the audio recheck rejects access (full: %s)', async fullScan => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const existing = song('keep-permission-recheck');
  const state = createSongLibraryState([existing]);
  const persist = jest.fn(async (read: () => Song[]) => read()); state.configurePersistence(persist);
  const scan = jest.fn(); const selectFolder = jest.fn();
  const get = jest.fn().mockResolvedValue({ status: 'denied', canAskAgain: true });
  const screen = render(<HookHarness fullScan={fullScan} songs={[existing]} songImport={state}
    getMediaLibraryPermissionsAsync={get} scanMediaLibraryCandidatesImpl={scan} onSelectMusicFolder={selectFolder} />);
  fireEvent.press(screen.getByText('import'));
  await waitFor(() => expect(showAlert).toHaveBeenCalled());
  expect(scan).not.toHaveBeenCalled();
  expect(get).toHaveBeenCalledTimes(2);
  expect(state.getCurrent()).toEqual([existing]); expect(persist).not.toHaveBeenCalled();
  expect(persistChangedFolderUpdates).not.toHaveBeenCalled();
  expect(getLibraryScanOperation()).toMatchObject({ status: 'failed', fullScan });
  expect(setLoading).toHaveBeenLastCalledWith(false);
  const buttons = showAlert.mock.calls[0][0].buttons;
  buttons.find((button: { text: string }) => button.text === 'Musikordner auswählen').onPress();
  expect(selectFolder).toHaveBeenCalledTimes(1);
});

test('a timed-out permission check cannot prompt or scan after a late native result', async () => {
  jest.useFakeTimers();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  let complete!: (value: { status: string; canAskAgain: boolean }) => void;
  const get = jest.fn(() => new Promise(resolve => { complete = resolve; }));
  const request = jest.fn(); const scan = jest.fn();
  const screen = render(<HookHarness getMediaLibraryPermissionsAsync={get}
    requestMediaLibraryPermissionsAsync={request} scanMediaLibraryCandidatesImpl={scan}
    importTimeoutMs={10} withTimeoutImpl={withTimeout} />);
  fireEvent.press(screen.getByText('import'));
  await act(async () => { await jest.advanceTimersByTimeAsync(10); });
  expect(setLoading).toHaveBeenLastCalledWith(false);
  expect(showAlert).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Musikzugriff konnte nicht rechtzeitig') }));
  await act(async () => { complete({ status: 'denied', canAskAgain: true }); await Promise.resolve(); });
  expect(request).not.toHaveBeenCalled(); expect(scan).not.toHaveBeenCalled();
  expect(setSongs).not.toHaveBeenCalled();
  jest.useRealTimers();
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

  await waitFor(() => expect(setLoading).toHaveBeenLastCalledWith(false));
  expect(showAlert).not.toHaveBeenCalled();
  expect(confirmLibraryImportImpl).not.toHaveBeenCalled();
  expect(enrichMediaLibraryAssetsImpl).not.toHaveBeenCalled();
  expect(setSongs).not.toHaveBeenCalled();
});

test('imports authorized media without an additional confirmation dialog', async () => {
  const confirm = jest.fn().mockResolvedValue(false);
  const enrich = jest.fn().mockResolvedValue({ songs: [song('media-song')] });
  const screen = render(<HookHarness confirmLibraryImportImpl={confirm} enrichMediaLibraryAssetsImpl={enrich} />);
  fireEvent.press(screen.getByText('import'));
  await waitFor(() => expect(enrich).toHaveBeenCalledTimes(1));
  expect(confirm).not.toHaveBeenCalled();
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


test.each(['saf', 'media'] as const)('finishes the %s scan before optional waveform analysis settles', async source => {
  let finishAnalysis!: () => void;
  jest.mocked(prepareLibraryWaveforms).mockImplementationOnce(() => new Promise(resolve => { finishAnalysis = resolve; }));
  const state = createSongLibraryState([]);
  state.configurePersistence(async read => read());
  const imported = song('playable');
  const statistics = { newCount: 1, changedCount: 0, unchangedCount: 0, unverifiedCount: 0, errorCount: 0 };
  const result = { songs: [imported], errors: [], statistics, completed: true };
  const screen = render(<HookHarness songImport={state} scanFolders={source === 'saf' ? [folder('music')] : []}
    importSongsFromSourcesImpl={jest.fn().mockResolvedValue(result)}
    enrichMediaLibraryAssetsImpl={jest.fn().mockResolvedValue(result)} />);
  try {
    fireEvent.press(screen.getByText('import'));
    await waitFor(() => expect(prepareLibraryWaveforms).toHaveBeenCalled());
    expect(setSongs).toHaveBeenCalledWith([imported]);
    expect(setLoading).toHaveBeenLastCalledWith(false);
    expect(setImportStatus).toHaveBeenLastCalledWith(null);
    expect(getLibraryScanOperation().status).toBe('completed');
    // Scan cancellation after completion must not relabel the committed result.
    fireEvent.press(screen.getByText('cancel import'));
    expect(getLibraryScanOperation().status).toBe('completed');
  } finally {
    await act(async () => { finishAnalysis?.(); });
  }
});

test('reports a folder-state write failure as visible partial success', async () => {
  persistChangedFolderUpdates.mockRejectedValueOnce(new Error('storage full'));
  const imported = song('retained');
  const screen = render(<HookHarness scanFolders={[folder('music')]}
    importSongsFromSourcesImpl={jest.fn().mockResolvedValue({ songs: [imported], errors: [], folderUpdates: [folder('music')] })} />);
  fireEvent.press(screen.getByText('import'));
  await waitFor(() => expect(setLoading).toHaveBeenLastCalledWith(false));
  expect(setSongs).toHaveBeenCalledWith([imported]);
  expect(showAlert).toHaveBeenCalledWith(expect.objectContaining({ title: 'Bibliothek gespeichert – Ordnerdaten fehlen' }));
  expect(getLibraryScanOperation().status).toBe('partial');
});


test('both sources are processed without a second import confirmation', async () => {
  const folders = jest.fn().mockResolvedValue({ songs: [song('saf-song')], errors: [] });
  const confirm = jest.fn().mockResolvedValue(false);
  const screen = render(<HookHarness source="both" scanFolders={[folder('music')]} confirmLibraryImportImpl={confirm} importSongsFromSourcesImpl={folders} />);
  fireEvent.press(screen.getByText('import'));
  await waitFor(() => expect(folders).toHaveBeenCalledTimes(1));
  expect(confirm).not.toHaveBeenCalled();
});
test('an unchanged update resumes retained waveform work without reimporting known tracks', async () => {
  jest.mocked(hasPendingWaveformPreparation).mockReturnValue(true);
  const scan = jest.fn().mockResolvedValue({ songs: [], errors: [], reusedCount: 1, statistics: {
    newCount: 0, changedCount: 0, unchangedCount: 1, unverifiedCount: 0, duplicateCount: 0, errorCount: 0 } });
  const screen = render(<HookHarness scanFolders={[folder('music')]} songs={[song('existing')]}
    importSongsFromSourcesImpl={scan} />);
  fireEvent.press(screen.getByText('import'));
  await waitFor(() => expect(setLoading).toHaveBeenLastCalledWith(false));
  expect(scan).toHaveBeenCalledTimes(1);
  expect(prepareLibraryWaveforms).toHaveBeenCalledWith([]);
  expect(showAlert).not.toHaveBeenCalled();
});

test.each(['saf', 'media'] as const)('an unverified %s result keeps a visible warning without a native completion dialog', async source => {
  const result = { songs: [], errors: [], reusedCount: 1, unverifiedCount: 1, completed: true,
    statistics: { newCount: 0, changedCount: 0, unchangedCount: 0, unverifiedCount: 1, duplicateCount: 0, errorCount: 0 } };
  const screen = render(<HookHarness showScanSummary songs={[song('existing')]}
    scanFolders={source === 'saf' ? [folder('music')] : []}
    importSongsFromSourcesImpl={jest.fn().mockResolvedValue(result)}
    enrichMediaLibraryAssetsImpl={jest.fn().mockResolvedValue(result)} />);
  fireEvent.press(screen.getByText('import'));
  await waitFor(() => expect(getLibraryScanOperation().status).toBe('completed'));
  expect(showAlert).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Verarbeitungsdetails öffnen'));
  expect(screen.getByText('1 ungeprüft · 0 Leseprobleme')).toBeTruthy();
  expect(screen.getByLabelText('Scan erneut versuchen')).toBeTruthy();
});


test.each(['denied', 'granted'] as const)('automatic source selection preserves SAF when MediaStore is %s or rejects its query', async status => {
  const existing = song('keep-existing');
  const state = createSongLibraryState([existing]);
  state.configurePersistence(async read => read());
  const request = jest.fn();
  const media = jest.fn().mockRejectedValue(new Error('Missing MEDIA_LIBRARY permissions.'));
  const folders = jest.fn().mockResolvedValue({ songs: [song('healthy-folder')], errors: [] });
  const screen = render(<HookHarness source="auto" scanFolders={[folder('music')]} songs={[existing]} songImport={state}
    getMediaLibraryPermissionsAsync={jest.fn().mockResolvedValue({ status })} requestMediaLibraryPermissionsAsync={request}
    scanMediaLibraryCandidatesImpl={media} importSongsFromSourcesImpl={folders} />);
  fireEvent.press(screen.getByText('import'));
  await waitFor(() => expect(setLoading).toHaveBeenLastCalledWith(false));
  expect(folders).toHaveBeenCalledTimes(1);
  expect(media).toHaveBeenCalledTimes(status === 'granted' ? 1 : 0);
  expect(request).not.toHaveBeenCalled(); expect(showAlert).not.toHaveBeenCalled();
  expect(state.getCurrent().map(song => song.id).sort()).toEqual(['healthy-folder', 'keep-existing']);
});
