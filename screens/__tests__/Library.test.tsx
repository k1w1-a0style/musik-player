import React from 'react';
import { Alert, Platform, Pressable, Text } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import Library from '../Library';
import { APP_STACK_ROUTES } from '../../types/routes';

const mockThemeTokens = {
  spacing: { xs: 4, sm: 8, md: 14, lg: 20, xl: 28, xxl: 40 },
  radii: { input: 10, card: 14, elevatedCard: 20, control: 18 },
  fonts: { display: 'Bricolage-Bold', heading: 'Bricolage-SemiBold', body: 'Bricolage-Regular' },
};

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
    tokens: mockThemeTokens,
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

jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: () => mockMediaPermission(),
}));

jest.mock('../../components/AppBackground', () => ({ children }: { children: React.ReactNode }) => <>{children}</>);
jest.mock('../../components/Screen', () => ({ children }: { children: React.ReactNode }) => <>{children}</>);
jest.mock('../../components/SongCard', () => ({ song, onInfoSong }: { song: { id: string }; onInfoSong: (song: { id: string }) => void }) => (
  <MockPressable testID={`info-${song.id}`} onPress={() => onInfoSong(song)}><MockText>info</MockText></MockPressable>
));
jest.mock('../../components/LibraryFolderRow', () => ({ folder, onRemove }: { folder: { id: string; name: string }; onRemove: (id: string) => void }) => (
  <MockPressable testID={`remove-folder-${folder.id}`} onPress={() => onRemove(folder.id)}><MockText>{folder.name}</MockText></MockPressable>
));

beforeEach(() => {
  mockNavigate.mockClear();
  mockSetSongs.mockClear();
  mockPlaySong.mockClear();
  mockPlayPlaylist.mockClear();
  mockGetScanFolders.mockClear();
  mockGetFavoriteSongIds.mockClear();
  mockUpdateScanFolder.mockClear();
  mockRemoveScanFolder.mockClear();
  mockAddScanFolder.mockClear();
  mockRequestDirPermissions.mockClear();
  mockMediaPermission.mockClear();
  mockImportSongs.mockClear();
  mockMediaCandidates.mockClear();
  mockMediaEnrich.mockClear();
  mockRefreshSongsFromId3.mockClear();
  mockPlaylists = [];
  mockLibraryControllerCrash = false;
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  jest.spyOn(Platform, 'select').mockImplementation((options: any) => options?.default ?? options?.android);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('opens track info screen from library song info action', async () => {
  const { findByTestId } = render(<Library />);
  const infoButton = await findByTestId('info-s1');

  fireEvent.press(infoButton);

  expect(mockNavigate).toHaveBeenCalledWith(APP_STACK_ROUTES.TRACK_INFO, { songId: 's1' });
});

test('opens playlist detail screen from playlist row body', async () => {
  mockPlaylists = [{ id: 'pl-1', name: 'Road Mix', songIds: ['s1'] }];
  const { findByTestId } = render(<Library />);
  const openButton = await findByTestId('open-playlist-pl-1');

  fireEvent.press(openButton);

  expect(mockNavigate).toHaveBeenCalledWith(APP_STACK_ROUTES.PLAYLIST_DETAIL, { playlistId: 'pl-1' });
});

test('keeps playlist play button wired to playlist playback', async () => {
  mockPlaylists = [{ id: 'pl-1', name: 'Road Mix', songIds: ['s1'] }];
  const { findByTestId } = render(<Library />);
  const playButton = await findByTestId('play-playlist-pl-1');

  fireEvent.press(playButton);

  expect(mockPlayPlaylist).toHaveBeenCalledWith('pl-1');
  expect(mockNavigate).not.toHaveBeenCalledWith(APP_STACK_ROUTES.PLAYLIST_DETAIL, expect.anything());
});

test('recovers through the screen error boundary when library controller crashes', () => {
  mockLibraryControllerCrash = true;

  const { getByText } = render(<Library />);

  expect(getByText('Library konnte nicht geladen werden.')).toBeTruthy();
});
