import React from 'react';
import { Alert, Image, Pressable, Text } from 'react-native';
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
const mockAddScanFolder = jest.fn(async (_folder: any) => []);
const mockRequestDirPermissions = jest.fn(async () => ({ granted: false }));
const mockMediaPermission = jest.fn(async () => ({ status: 'granted' }));
const mockScanMedia = jest.fn(async () => ({ songs: [], skipped: [], errors: [], sourceSummary: [] }));
const mockScanSaf = jest.fn(async (_folders: any[]) => ({ songs: [], skipped: [], errors: [], sourceSummary: [], folderUpdates: [] }));

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
  scanFromMediaLibrary: () => mockScanMedia(),
  scanFromSafFolders: (folders: any[]) => mockScanSaf(folders),
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

describe('Library', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('hides broken preview image after error', async () => {
    const { UNSAFE_getByType, UNSAFE_queryByType } = render(<Library />);
    await waitFor(() => expect(mockGetScanFolders).toHaveBeenCalled());
    fireEvent(UNSAFE_getByType(Image), 'error');
    expect(UNSAFE_queryByType(Image)).toBeNull();
  });

  test('opens track info without starting playback', async () => {
    const { getByTestId } = render(<Library />);
    await waitFor(() => expect(mockGetScanFolders).toHaveBeenCalled());
    fireEvent.press(getByTestId('info-s1'));
    expect(mockNavigate).toHaveBeenCalledWith(APP_STACK_ROUTES.TRACK_INFO, { songId: 's1' });
    expect(mockPlaySong).not.toHaveBeenCalled();
  });

  test('shows scan folders and allows remove', async () => {
    mockGetScanFolders.mockResolvedValueOnce([{ id: 'f1', name: 'Music', uri: 'content://music', addedAt: 1, enabled: true }]);
    mockRemoveScanFolder.mockResolvedValueOnce([]);
    const { getByText } = render(<Library />);
    await waitFor(() => expect(getByText('Music')).toBeTruthy());
    fireEvent.press(getByText('Entfernen'));
    await waitFor(() => expect(mockRemoveScanFolder).toHaveBeenCalledWith('f1'));
  });

  test('uses media-library fallback when no scan folders', async () => {
    mockGetScanFolders.mockResolvedValueOnce([]);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { getByText } = render(<Library />);
    fireEvent.press(getByText('Importieren'));
    await waitFor(() => expect(mockMediaPermission).toHaveBeenCalled());
    expect(mockScanMedia).toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
