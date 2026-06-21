import React from 'react';
import { Alert, Platform, Pressable, Text } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import Library from '../Library';
import { APP_STACK_ROUTES } from '../../types/routes';

const MockPressable = Pressable;
const MockText = Text;
const mockPlaySong = jest.fn(async () => undefined);
const mockPlayPlaylist = jest.fn(async () => undefined);
let mockPlaylists: Array<{ id: string; name: string; songIds: string[] }> = [];
const mockNavigate = jest.fn();
const mockSetSongs = jest.fn();
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
      setSongs: mockSetSongs,
      currentSong: { id: 's1', title: 'Song', artist: 'Artist', cover: 'file:///broken.jpg' },
      playSong: mockPlaySong,
      isReady: true,
      isPlaying: false,
      playlists: mockPlaylists,
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

jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: () => mockMediaPermission(),
}));

jest.mock('../../components/AppBackground', () => ({ children }: { children: React.ReactNode }) => <>{children}</>);
jest.mock('../../components/Screen', () => ({ children }: { children: React.ReactNode }) => <>{children}</>);
jest.mock('../../components/SongCard', () => ({ song, onInfoSong }: { song: { id: string }; onInfoSong: (song: { id: string }) => void }) => (
  <MockPressable testID={`info-${song.id}`} onPress={() => onInfoSong(song)}><MockText>info</MockText></MockPressable>
));

const openOverflowMenu = (getByLabelText: (label: string) => ReturnType<typeof render>['getByLabelText']) => {
  fireEvent.press(getByLabelText('Mehr Optionen'));
};

const pressImportMenuItem = (getByText: ReturnType<typeof render>['getByText']) => {
  fireEvent.press(getByText('Importieren / Rescan'));
};

describe('Library', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlaylists = [];
    mockLibraryControllerCrash = false;
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
    const { getByText, queryByText } = view;

    await waitFor(() => expect(mockGetScanFolders).toHaveBeenCalled());

    expect(getByText('K1W1 Music')).toBeTruthy();
    expect(getByText('Titel')).toBeTruthy();
    expect(getByText('Favoriten')).toBeTruthy();
    expect(getByText('Genres')).toBeTruthy();
    expect(getByText('Ordner')).toBeTruthy();
    expect(getByText('Name')).toBeTruthy();
    expect(queryByText('Scan-Ordner')).toBeNull();
    expect(queryByText('Bibliothek')).toBeNull();

    view.unmount();
  });

  test('opens track info without starting playback', async () => {
    const view = render(<Library />);
    const { getByTestId } = view;

    await waitFor(() => expect(mockGetScanFolders).toHaveBeenCalled());

    fireEvent.press(getByTestId('info-s1'));

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

  test('metadata refresh action updates songs and reports result', async () => {
    const refreshedSongs = [{ id: 's1', title: 'Fresh Song', artist: 'Artist', cover: 'file:///broken.jpg' }];
    mockRefreshSongsFromId3.mockResolvedValueOnce({ songs: refreshedSongs, updated: 1, skipped: 0, failed: 0, errors: [] });
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    const view = render(<Library />);
    const { getByLabelText, getByText } = view;

    await waitFor(() => expect(mockGetScanFolders).toHaveBeenCalled());
    openOverflowMenu(getByLabelText);
    fireEvent.press(getByText('Metadaten aktualisieren'));

    await waitFor(() => expect(mockRefreshSongsFromId3).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 's1' })])));
    expect(mockSetSongs).toHaveBeenCalledWith(refreshedSongs);
    expect(Alert.alert).toHaveBeenCalledWith('Metadaten aktualisiert', '1 Titel aktualisiert. 0 übersprungen. 0 fehlgeschlagen.');
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