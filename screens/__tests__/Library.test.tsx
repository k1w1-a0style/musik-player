import React from 'react';
import { Alert, Platform, Pressable, Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import Library from '../Library';
import { APP_STACK_ROUTES } from '../../types/routes';
import { createSongLibraryState, type SongLibraryState } from '../../contexts/songLibraryState';

const mockAppThemeContextValue = {
  appearance: 'dark',
  skin: 'graphite',
  isHydrated: true,
  setAppearance: jest.fn(),
  setSkin: jest.fn(),
  theme: {
    id: 'graphite-dark',
    appearance: 'dark',
    skin: 'graphite',
    label: 'Graphite Dark',
    navigationDark: true,
    statusBarStyle: 'light-content',
    palette: {
      background: '#07090C',
      backgroundDeep: '#030406',
      surface: '#101218',
      surfaceElevated: '#191B21',
      surfaceGlass: 'rgba(18, 20, 26, 0.76)',
      card: '#111318',
      cardElevated: '#1A1D24',
      border: 'rgba(255, 255, 255, 0.08)',
      borderStrong: 'rgba(210, 218, 230, 0.28)',
      primary: '#D8DEE8',
      primaryDark: '#87909E',
      primaryGlow: 'rgba(216, 222, 232, 0.12)',
      accent: '#BFC7D4',
      accentGlow: 'rgba(191, 199, 212, 0.10)',
      success: '#D8DEE8',
      error: '#FF6F8A',
      warning: '#FFCA77',
      text: {
        primary: '#F4F5F7',
        secondary: 'rgba(244, 245, 247, 0.70)',
        muted: 'rgba(244, 245, 247, 0.42)',
        onPrimary: '#07090C',
      },
    },
    gradients: {
      background: ['#07090C', '#101218', '#191B21'],
      nowPlaying: ['#07090C', '#191B21', '#101218'],
    },
  },
};

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => mockAppThemeContextValue,
  useOptionalAppTheme: () => mockAppThemeContextValue,
}));

const MockPressable = Pressable;
const MockText = Text;
const mockPlaySong = jest.fn(async () => undefined);
const mockPlayPlaylist = jest.fn(async () => undefined);
const mockAddSongToPlaylist = jest.fn();
const mockRemoveSongFromPlaylist = jest.fn();
let mockPlaylists: Array<{ id: string; name: string; songIds: string[] }> = [];
const mockNavigate = jest.fn();
const mockSetSongs = jest.fn();
let mockSongLibrary: SongLibraryState;
const mockGetScanFolders = jest.fn<Promise<any[]>, []>(async () => []);
const mockGetFavoriteSongIds = jest.fn<Promise<string[]>, []>(async () => []);
const mockUpdateScanFolder = jest.fn(async (_id: string, _patch: any) => []);
const mockRemoveScanFolder = jest.fn(async (_id: string) => []);
const mockAddScanFolder = jest.fn<Promise<any[]>, [any]>(async (_folder: any) => []);
const mockRequestDirPermissions = jest.fn<Promise<{ granted: boolean; directoryUri?: string }>, []>(async () => ({ granted: false }));
const mockMediaPermission = jest.fn(async () => ({ status: 'granted' }));
const mockImportSongs = jest.fn<Promise<any>, [any?]>(async (_options?: any) => ({ songs: [], skipped: [], errors: [], sourceSummary: [], folderUpdates: [] }));
const mockMediaCandidates = jest.fn<Promise<any>, []>(async () => ({ assets: [], skipped: [] }));
const mockMediaEnrich = jest.fn<Promise<any>, any[]>(async () => ({ songs: [], skipped: [], errors: [], sourceSummary: [] }));
const mockRefreshSongsFromId3 = jest.fn<Promise<any>, [any[]]>(async songs => ({ songs, updated: 0, skipped: 0, failed: 0, errors: [] }));
let mockLibraryControllerCrash = false;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('../../contexts/MusicContext', () => ({
  useLibraryMusicContext: () => {
    if (mockLibraryControllerCrash) throw new Error('library controller crash');

    return {
      songs: [{ id: 's1', title: 'Song', artist: 'Artist', cover: 'file:///broken.jpg' }],
      songImport: mockSongLibrary,
      setSongs: mockSetSongs,
      currentSong: { id: 's1', title: 'Song', artist: 'Artist', cover: 'file:///broken.jpg' },
      playSong: mockPlaySong,
      isReady: true,
      isPlaying: false,
      playlists: mockPlaylists,
      addSongToPlaylist: mockAddSongToPlaylist,
      removeSongFromPlaylist: mockRemoveSongFromPlaylist,
      playPlaylist: mockPlayPlaylist,
    };
  },
}));

jest.mock('../../utils/storage', () => ({
  getScanFolders: () => mockGetScanFolders(),
  getFavoriteSongIds: () => mockGetFavoriteSongIds(),
  updateScanFolder: (id: string, patch: any) => mockUpdateScanFolder(id, patch),
  removeScanFolder: (id: string) => mockRemoveScanFolder(id),
  addScanFolder: (folder: any) => mockAddScanFolder(folder),
  storage: {
    getLibrarySortMode: jest.fn().mockResolvedValue('alphabet'),
    setLibrarySortMode: jest.fn().mockResolvedValue(undefined),
    getLibrarySongViewMode: jest.fn().mockResolvedValue('list'),
    setLibrarySongViewMode: jest.fn().mockResolvedValue(undefined),
    getAlbumViewMode: jest.fn().mockResolvedValue('grid'),
    setAlbumViewMode: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../utils/mediaLibraryImport', () => ({
  deriveFolderNameFromUri: (uri: string) => uri.includes('soundloadmate') ? 'soundloadmate' : 'Music',
  importSongsFromSources: (options: any) => mockImportSongs(options),
  scanMediaLibraryCandidates: () => mockMediaCandidates(),
  enrichMediaLibraryAssets: (...args: any[]) => mockMediaEnrich(...args),
}));

jest.mock('../../utils/songMetadataRefresh', () => ({
  refreshSongsFromId3: (songs: any[]) => mockRefreshSongsFromId3(songs),
}));

jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(async () => ({ exists: true, size: 0 })),
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: () => mockRequestDirPermissions(),
    readDirectoryAsync: jest.fn(),
  },
}));

jest.mock('expo-media-library/legacy', () => ({
  requestPermissionsAsync: () => mockMediaPermission(),
}));

jest.mock('../../components/AppBackground', () => ({ children }: { children: React.ReactNode }) => <>{children}</>);
jest.mock('../../components/Screen', () => ({ children }: { children: React.ReactNode }) => <>{children}</>);
jest.mock('../../components/SongCard', () => ({ song, onInfoSong }: { song: { id: string }; onInfoSong: (song: { id: string }) => void }) => (
  <MockPressable testID={`info-${song.id}`} onPress={() => onInfoSong(song)}><MockText>info</MockText></MockPressable>
));

const openOverflowMenu = (getByLabelText: ReturnType<typeof render>['getByLabelText']) => {
  fireEvent.press(getByLabelText('Mehr Optionen'));
};

const pressImportMenuItem = (getByText: ReturnType<typeof render>['getByText']) => {
  fireEvent.press(getByText('Schnellscan / Import'));
};

describe('Library', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlaylists = [];
    mockLibraryControllerCrash = false;
    mockSongLibrary = createSongLibraryState([{ id: 's1', title: 'Song', artist: 'Artist', cover: 'file:///broken.jpg' }]);
    mockSongLibrary.configurePersistence(async read => read());
    mockSongLibrary.configureImportPublication(songs => { mockSetSongs(songs); mockSongLibrary.setSongs(songs); });
  });

  test('renders the screen fallback when the inner controller component throws', () => {
    mockLibraryControllerCrash = true;
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const view = render(<Library />);

    expect(view.getByTestId('library-error-boundary-fallback')).toBeTruthy();
    expect(view.getByText('Bereich konnte nicht geladen werden.')).toBeTruthy();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[LibraryScreen] ErrorBoundary caught an error',
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) }),
    );

    consoleErrorSpy.mockRestore();
    view.unmount();
  });

  test('renders compact Samsung-style library chrome without the old scan block', async () => {
    const view = render(<Library />);
    const { getAllByText, getByText, queryByText } = view;

    await waitFor(() => expect(mockGetScanFolders).toHaveBeenCalled());

    expect(getByText('K1W1 Music')).toBeTruthy();
    expect(getAllByText('Titel')).toHaveLength(2);
    expect(getByText('Favoriten')).toBeTruthy();
    expect(getByText('Genres')).toBeTruthy();
    expect(getByText('Ordner')).toBeTruthy();
    expect(queryByText('Name')).toBeNull();
    expect(queryByText('Scan-Ordner')).toBeNull();
    expect(queryByText('Bibliothek')).toBeNull();

    view.unmount();
  });

  test('opens track info without starting playback', async () => {
    const view = render(<Library />);
    const { getByTestId } = view;

    await waitFor(() => expect(mockGetScanFolders).toHaveBeenCalled());

    fireEvent.press(getByTestId('info-s1'));
    fireEvent.press(view.getByText('Titelinformationen öffnen'));

    expect(mockNavigate).toHaveBeenCalledWith(APP_STACK_ROUTES.TRACK_INFO, { songId: 's1' });
    expect(mockPlaySong).not.toHaveBeenCalled();

    view.unmount();
  });

  test('renders playlists inside the library tab and plays selected playlist', async () => {
    mockPlaylists = [{ id: 'pl1', name: 'Meine Liste', songIds: ['s1'] }];

    const view = render(<Library />);
    const { getByLabelText, getByText } = view;

    await waitFor(() => expect(mockGetScanFolders).toHaveBeenCalled());

    fireEvent.press(getByLabelText('Playlisten anzeigen'));
    expect(getByText('Meine Liste')).toBeTruthy();
    expect(getByText('1 Titel')).toBeTruthy();

    fireEvent.press(getByLabelText('Playlist Meine Liste abspielen'));
    expect(mockPlayPlaylist).toHaveBeenCalledWith('pl1');

    view.unmount();
  });

  test('shows active scan folder count in the overflow menu', async () => {
    mockGetScanFolders.mockResolvedValueOnce([{ id: 'f1', name: 'Music', uri: 'content://music', addedAt: 1, enabled: true }]);

    const view = render(<Library />);
    const { getByLabelText, getByText } = view;

    await waitFor(() => expect(mockGetScanFolders).toHaveBeenCalled());

    openOverflowMenu(getByLabelText);
    expect(getByText('Aktive Scan-Ordner: 1')).toBeTruthy();
    view.unmount();
  });

  test('the single scan action updates existing metadata without a second metadata pass', async () => {
    const refreshedSongs = [{ id: 's1', title: 'Fresh Song', artist: 'Artist', cover: 'file:///broken.jpg' }];
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    mockGetScanFolders.mockResolvedValueOnce([{ id: 'f1', name: 'Music', uri: 'content://music', addedAt: 1, enabled: true }]);
    mockImportSongs.mockResolvedValueOnce({ songs: refreshedSongs, skipped: [], errors: [], sourceSummary: [] });
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    const view = render(<Library />);
    const { getByLabelText, getByText } = view;

    await waitFor(() => expect(mockGetScanFolders).toHaveBeenCalled());
    openOverflowMenu(getByLabelText);
    expect(view.queryByText('Metadaten aktualisieren')).toBeNull();
    pressImportMenuItem(getByText);

    await waitFor(() => expect(mockSetSongs).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 's1', title: 'Fresh Song' })])));
    expect(mockImportSongs).toHaveBeenCalledTimes(1);
    expect(mockRefreshSongsFromId3).not.toHaveBeenCalled();
    view.unmount();
  });

  test('the library scan button cancels the real import generation and keeps confirmed tracks', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    mockGetScanFolders.mockResolvedValueOnce([{ id: 'f1', name: 'Music', uri: 'content://music', addedAt: 1, enabled: true }]);
    let resolveScan!: (result: { songs: any[]; errors: string[] }) => void;
    let scanOptions: any;
    const confirmed = { id: 'confirmed', title: 'Confirmed', artist: 'Artist', uri: 'content://music/confirmed.mp3' };
    mockImportSongs.mockImplementationOnce(async options => {
      scanOptions = options;
      options.onFileProgress({ processed: 0, total: 2, currentTitle: 'Confirmed', statistics:
        { newCount: 0, changedCount: 0, unchangedCount: 0, unverifiedCount: 0, duplicateCount: 0, errorCount: 0 } });
      await options.onCheckpoint({ songs: [confirmed], processed: 1, total: 2 });
      options.onFileProgress({ processed: 1, total: 2, currentTitle: 'Pending', statistics:
        { newCount: 1, changedCount: 0, unchangedCount: 0, unverifiedCount: 0, duplicateCount: 0, errorCount: 0 } });
      return new Promise(resolve => { resolveScan = resolve; });
    });
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const view = render(<Library />);
    await waitFor(() => expect(mockGetScanFolders).toHaveBeenCalled());
    openOverflowMenu(view.getByLabelText);
    pressImportMenuItem(view.getByText);
    await waitFor(() => expect(mockSetSongs).toHaveBeenCalledWith(expect.arrayContaining([confirmed])));

    fireEvent.press(view.getByLabelText('Scan abbrechen'));
    expect(view.queryByTestId('library-import-scan-animation')).toBeNull();
    expect(view.getByText('Schnellscan – abgebrochen')).toBeTruthy();
    expect(view.getByText('1 von 2 gefundenen Dateien verarbeitet')).toBeTruthy();
    await waitFor(() => expect(scanOptions.signal.aborted).toBe(true));
    const publications = mockSetSongs.mock.calls.length;
    await act(async () => {
      await scanOptions.onCheckpoint({ songs: [{ ...confirmed, id: 'late' }], processed: 2, total: 2 });
      scanOptions.onFileProgress({ processed: 2, total: 2, currentTitle: '', statistics:
        { newCount: 2, changedCount: 0, unchangedCount: 0, unverifiedCount: 0, duplicateCount: 0, errorCount: 0 } });
      resolveScan({ songs: [{ ...confirmed, id: 'late-result' }], errors: [] });
    });
    expect(mockSetSongs).toHaveBeenCalledTimes(publications);
    expect(mockSongLibrary.getCurrent().map(song => song.id).sort()).toEqual(['confirmed', 's1']);
    expect(alert).not.toHaveBeenCalled();
    expect(view.getByText('1 von 2 gefundenen Dateien verarbeitet')).toBeTruthy();
    view.unmount();
  });

  test('adding a folder scans only that folder without refreshing existing sources', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    const previous = { id: 'f1', name: 'Music', uri: 'content://music', addedAt: 1, enabled: true };
    mockGetScanFolders.mockResolvedValueOnce([previous]);
    mockRequestDirPermissions.mockResolvedValueOnce({ granted: true, directoryUri: 'content://new-folder' });
    mockAddScanFolder.mockImplementationOnce(async folder => [previous, folder]);
    const view = render(<Library />);
    await waitFor(() => expect(mockGetScanFolders).toHaveBeenCalled());
    openOverflowMenu(view.getByLabelText);
    fireEvent.press(view.getByText('Ordner hinzufügen'));
    await waitFor(() => expect(mockImportSongs).toHaveBeenCalled());
    expect(mockImportSongs).toHaveBeenCalledTimes(1);
    expect(mockImportSongs.mock.calls[0][0]).toMatchObject({
      scanFolders: [expect.objectContaining({ uri: 'content://new-folder' })], refreshExisting: false,
    });
    view.unmount();
  });

  test('does not enrich media when import confirmation is cancelled', async () => {
    mockMediaCandidates.mockResolvedValueOnce({ assets: [{ id: 'a1', uri: 'file:///a.mp3' }], skipped: [] });
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.[0]?.onPress?.();
    });

    const view = render(<Library />);
    const { getByLabelText, getByText } = view;

    await waitFor(() => expect(mockGetScanFolders).toHaveBeenCalled());
    openOverflowMenu(getByLabelText);
    pressImportMenuItem(getByText);

    await waitFor(() => expect(mockMediaCandidates).toHaveBeenCalled());
    expect(mockMediaEnrich).not.toHaveBeenCalled();
    view.unmount();
  });

  test('on android SAF errors with songs imports and shows one partial warning', async () => {
    Platform.OS = 'android';
    mockGetScanFolders.mockResolvedValueOnce([{ id: 'f1', name: 'Music', uri: 'content://music', addedAt: 1, enabled: true }]);
    mockImportSongs.mockResolvedValueOnce({
      songs: [{ id: 'x', title: 'X', artist: 'Y', uri: 'content://x' }],
      skipped: [],
      errors: ['content://bad'],
      sourceSummary: [],
      folderUpdates: [{ id: 'f1', name: 'Music', uri: 'content://music', addedAt: 1, enabled: true, lastError: 'Teilweise nicht lesbar' }],
    });
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    const view = render(<Library />);
    const { getByLabelText, getByText } = view;

    await waitFor(() => expect(mockGetScanFolders).toHaveBeenCalled());
    openOverflowMenu(getByLabelText);
    pressImportMenuItem(getByText);

    await waitFor(() => expect(mockSetSongs).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 'x' })])));
    expect(Alert.alert).toHaveBeenCalledWith('Teilweise importiert', expect.any(String));
    view.unmount();
  });

  test('uses media-library fallback when no scan folders', async () => {
    mockMediaCandidates.mockResolvedValueOnce({ assets: [{ id: 'a1', uri: 'file:///a.mp3' }], skipped: [] });
    mockMediaEnrich.mockResolvedValueOnce({ songs: [{ id: 'a1', title: 'A', artist: 'B', uri: 'file:///a.mp3' }], skipped: [], errors: [], sourceSummary: [] });
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.[1]?.onPress?.();
    });

    const view = render(<Library />);
    const { getByLabelText, getByText } = view;

    await waitFor(() => expect(mockGetScanFolders).toHaveBeenCalled());
    openOverflowMenu(getByLabelText);
    pressImportMenuItem(getByText);

    await waitFor(() => expect(mockMediaPermission).toHaveBeenCalled());
    await waitFor(() => expect(mockSetSongs).toHaveBeenCalled());
    view.unmount();
  });
});
