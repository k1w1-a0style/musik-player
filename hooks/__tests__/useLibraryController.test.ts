import { renderHook } from '@testing-library/react-native';
import { useLibraryController } from '../useLibraryController';

jest.mock('../../contexts/MusicContext', () => ({
  useLibraryMusicContext: jest.fn(() => ({
    songs: [],
    setSongs: jest.fn(),
    currentSong: null,
    playSong: jest.fn(),
    isReady: true,
    isPlaying: false,
    playlists: [],
    playPlaylist: jest.fn(),
  })),
}));

jest.mock('../libraryHooks', () => ({
  useLibraryAlerts: jest.fn(() => ({ showAlert: jest.fn() })),
  useLibraryComponentProps: jest.fn(() => ({
    menuModalProps: { visible: false },
    tabContentProps: { activeTab: 'tracks' },
  })),
  useLibraryImportActions: jest.fn(() => ({ importFromDevice: jest.fn() })),
  useLibraryMenuActions: jest.fn(() => ({
    closeMenu: jest.fn(),
    openMenu: jest.fn(),
    openSettings: jest.fn(),
    toggleSearch: jest.fn(),
  })),
  useLibraryMetadataRefreshActions: jest.fn(() => ({ refreshMetadataFromFiles: jest.fn() })),
  useLibraryNavigationActions: jest.fn(() => ({ openTrackInfo: jest.fn() })),
  useLibraryPlaybackActions: jest.fn(() => ({
    handlePlayActiveList: jest.fn(),
    handleShufflePress: jest.fn(),
    toggleAlbumView: jest.fn(),
  })),
  useLibraryRenderers: jest.fn(() => ({
    getSongItemLayout: jest.fn(),
    handleSongPress: jest.fn(),
    renderAlbumTile: jest.fn(),
    renderFolderItem: jest.fn(),
    renderGroupItem: jest.fn(),
    renderPlaylistItem: jest.fn(),
    renderSongItem: jest.fn(),
    songKeyExtractor: jest.fn(),
  })),
  useLibraryScanFolderActions: jest.fn(() => ({
    showScanFolders: jest.fn(),
    onAddScanFolder: jest.fn(),
    persistChangedFolderUpdates: jest.fn(),
    removeFolder: jest.fn(),
  })),
  useLibraryScreenState: jest.fn(() => ({
    activeTab: 'tracks',
    albumViewMode: 'grid',
    importStatus: null,
    loading: false,
    menuOpen: false,
    query: '',
    searchOpen: false,
    setActiveTab: jest.fn(),
    setAlbumViewMode: jest.fn(),
    setImportStatus: jest.fn(),
    setLoading: jest.fn(),
    setMenuOpen: jest.fn(),
    setQuery: jest.fn(),
    setSearchOpen: jest.fn(),
  })),
  useLibraryStoredState: jest.fn(() => ({
    scanFolders: [],
    setScanFolders: jest.fn(),
    favoriteIds: [],
  })),
  useLibraryViewState: jest.fn(() => ({
    activeFolders: 0,
    albumGroups: [],
    artistGroups: [],
    emptyMessage: 'Leer',
    filteredSongs: [],
    genreGroups: [],
    playlistItems: [],
    songsForActiveList: [],
  })),
}));

test('returns library screen props from composed hooks', () => {
  const { result } = renderHook(() => useLibraryController());

  expect(result.current.activeTab).toBe('tracks');
  expect(result.current.importStatus).toBeNull();
  expect(result.current.loading).toBe(false);
  expect(result.current.query).toBe('');
  expect(result.current.searchOpen).toBe(false);
  expect(result.current.menuModalProps).toEqual({ visible: false });
  expect(result.current.tabContentProps).toEqual({ activeTab: 'tracks' });
  expect(result.current.topBarProps).toEqual({
    onOpenMenu: expect.any(Function),
    onToggleSearch: expect.any(Function),
  });
});
