import React from 'react';
import { Alert, Platform, Pressable, Text } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import Library from '../Library';
import { APP_STACK_ROUTES } from '../../types/routes';

const MockPressable = Pressable;
const MockText = Text;
const mockPlaySong = jest.fn(async () => undefined);
const mockNavigate = jest.fn();
const mockSetSongs = jest.fn();
const mockGetScanFolders = jest.fn<Promise<any[]>, []>(async () => []);
const mockUpdateScanFolder = jest.fn(async (_id: string, _patch: any) => []);
const mockRemoveScanFolder = jest.fn(async (_id: string) => []);
const mockAddScanFolder = jest.fn<Promise<any[]>, [any]>(async (_folder: any) => []);
const mockRequestDirPermissions = jest.fn<Promise<{ granted: boolean; directoryUri?: string }>, []>(async () => ({ granted: false }));
const mockMediaPermission = jest.fn(async () => ({ status: 'granted' }));
const mockImportSongs = jest.fn(async (_options?: any) => ({ songs: [], skipped: [], errors: [], sourceSummary: [], folderUpdates: [] }));
const mockMediaCandidates = jest.fn(async () => ({ assets: [], skipped: [] }));
const mockMediaEnrich = jest.fn(async () => ({ songs: [], skipped: [], errors: [], sourceSummary: [] }));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('../../contexts/MusicContext', () => ({
  useLibraryMusicContext: () => ({
    songs: [{ id: 's1', title: 'Song', artist: 'Artist', cover: 'file:///broken.jpg' }],
    setSongs: mockSetSongs,
    currentSong: { id: 's1', title: 'Song', artist: 'Artist', cover: 'file:///broken.jpg' },
    playSong: mockPlaySong,
    isReady: true,
    isPlaying: false,
  }),
}));

jest.mock('../../utils/storage', () => ({
  getScanFolders: () => mockGetScanFolders(),
  updateScanFolder: (id: string, patch: any) => mockUpdateScanFolder(id, patch),
  removeScanFolder: (id: string) => mockRemoveScanFolder(id),
  addScanFolder: (folder: any) => mockAddScanFolder(folder),
}));

jest.mock('../../utils/mediaLibraryImport', () => ({
  deriveFolderNameFromUri: () => 'Music',
  importSongsFromSources: (options: any) => mockImportSongs(options),
  scanMediaLibraryCandidates: () => mockMediaCandidates(),
  enrichMediaLibraryAssets: (...args: any[]) => (mockMediaEnrich as any)(...args),
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
  });

  test('renders compact Samsung-style library chrome without the old scan block', async () => {
    const view = render(<Library />);
    const { getByText, queryByText } = view;

    await waitFor(() => expect(mockGetScanFolders).toHaveBeenCalled());

    expect(getByText('K1W1 Music')).toBeTruthy();
    expect(getByText('Tracks')).toBeTruthy();
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

  test('shows active scan folder count in the overflow menu', async () => {
    mockGetScanFolders.mockResolvedValueOnce([{ id: 'f1', name: 'Music', uri: 'content://music', addedAt: 1, enabled: true }]);

    const view = render(<Library />);
    const { getByLabelText, getByText } = view;

    await waitFor(() => expect(mockGetScanFolders).toHaveBeenCalled());

    openOverflowMenu(getByLabelText);

    expect(getByText('Aktive Scan-Ordner: 1')).toBeTruthy();

    view.unmount();
  });

  test('adds scan folder from overflow menu', async () => {
    const previousOs = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'android' });

    mockGetScanFolders.mockResolvedValueOnce([]);
    mockRequestDirPermissions.mockResolvedValueOnce({ granted: true, directoryUri: 'content://music' });
    mockAddScanFolder.mockResolvedValueOnce([{ id: 'f1', name: 'Music', uri: 'content://music', addedAt: 1, enabled: true }]);

    const view = render(<Library />);
    const { getByLabelText, getByText } = view;

    await waitFor(() => expect(mockGetScanFolders).toHaveBeenCalled());

    openOverflowMenu(getByLabelText);
    fireEvent.press(getByText('Ordner hinzufügen'));

    await waitFor(() => expect(mockAddScanFolder).toHaveBeenCalledWith(expect.objectContaining({ uri: 'content://music', name: 'Music' })));

    Object.defineProperty(Platform, 'OS', { value: previousOs });
    view.unmount();
  });

  test('does not enrich media when import confirmation is cancelled', async () => {
    mockGetScanFolders.mockResolvedValueOnce([]);
    mockMediaCandidates.mockResolvedValueOnce(({ assets: [{ id: 'a1', uri: 'file:///a.mp3', filename: 'a.mp3', duration: 1 }], skipped: [] } as any));

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title: any, _msg?: any, buttons?: any) => {
      if (title === 'Musik importieren') buttons?.[0]?.onPress?.();
    });

    const view = render(<Library />);
    const { getByLabelText, getByText } = view;

    await waitFor(() => expect(mockGetScanFolders).toHaveBeenCalled());

    openOverflowMenu(getByLabelText);
    pressImportMenuItem(getByText);

    await waitFor(() => expect(mockMediaCandidates).toHaveBeenCalled());

    expect(mockMediaEnrich).not.toHaveBeenCalled();
    expect(mockSetSongs).not.toHaveBeenCalled();

    alertSpy.mockRestore();
    view.unmount();
  });

  test('on android SAF errors with songs imports and shows one partial warning', async () => {
    const previousOs = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'android' });

    mockGetScanFolders.mockResolvedValueOnce([{ id: 'f1', name: 'Music', uri: 'content://music', addedAt: 1, enabled: true }]);
    mockImportSongs.mockResolvedValueOnce({ songs: [{ id: 'x', title: 'A', artist: 'B' }], skipped: [], errors: ['content://music/error'], sourceSummary: [], folderUpdates: [] } as any);

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    const view = render(<Library />);
    const { getByLabelText, getByText } = view;

    await waitFor(() => expect(mockGetScanFolders).toHaveBeenCalled());

    openOverflowMenu(getByLabelText);
    pressImportMenuItem(getByText);

    await waitFor(() => expect(mockSetSongs).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 'x' })])));

    expect(alertSpy).toHaveBeenCalledWith('Teilweise importiert', expect.any(String));

    alertSpy.mockRestore();
    Object.defineProperty(Platform, 'OS', { value: previousOs });
    view.unmount();
  });

  test('uses media-library fallback when no scan folders', async () => {
    mockGetScanFolders.mockResolvedValueOnce([]);

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    const view = render(<Library />);
    const { getByLabelText, getByText } = view;

    await waitFor(() => expect(mockGetScanFolders).toHaveBeenCalled());

    openOverflowMenu(getByLabelText);
    pressImportMenuItem(getByText);

    await waitFor(() => expect(mockMediaPermission).toHaveBeenCalled());

    expect(mockMediaCandidates).toHaveBeenCalled();

    alertSpy.mockRestore();
    view.unmount();
  });
});
