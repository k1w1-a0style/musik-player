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

jest.mock('../useLibraryAlerts', () => ({
  useLibraryAlerts: jest.fn(() => ({ showAlert: jest.fn() })),
}));

jest.mock('../useLibraryComponentProps', () => ({
  useLibraryComponentProps: jest.fn(() => ({
    menuModalProps: { visible: false },
    tabContentProps: { activeTab: 'tracks' },
  })),
}));

jest.mock('../useLibraryImportActions', () => ({
  useLibraryImportActions: jest.fn(() => ({ importFromDevice: jest.fn() })),
}));

jest.mock('../useLibraryMenuActions', () => ({
  useLibraryMenuActions: jest.fn(() => ({
    closeMenu: jest.fn(),
    openMenu: jest.fn(),
    openSettings: jest.fn(),
    toggleSearch: jest.fn(),
  })),
}));

jest.mock('../useLibraryMetadataRefreshActions', () => ({
  useLibraryMetadataRefreshActions: jest.fn(() => ({ refreshMetadataFromFiles: jest.fn() })),
}));

jest.mock('../useLibraryNavigationActions', () => ({
  useLibraryNavigationActions: jest.fn(() => ({ openTrackInfo: jest.fn() })),
}));

jest.mock('../useLibraryPlaybackActions', () => ({
  useLibraryPlaybackActions: jest.fn(() => ({
    handlePlayActiveList: jest.fn(),
    handleShufflePress: jest.fn(),
    toggleAlbumView: jest.fn(),
  })),
}));

jest.mock('../useLibraryRenderers', () => ({
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
}));

jest.mock('../useLibraryScanFolderActions', () => ({
  useLibraryScanFolderActions: jest.fn(() => ({
    showScanFolders: jest.fn(),
    onAddScanFolder: jest.fn(),
    persistChangedFolderUpdates: jest.fn(),
    removeFolder: jest.fn(),
  })),
}));

jest.mock('../useLibraryScreenState', () => ({
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
}));

jest.mock('../useLibraryStoredState', () => ({
  useLibraryStoredState: jest.fn(() => ({
    scanFolders: [],
    setScanFolders: jest.fn(),
    favoriteIds: [],
  })),
}));

jest.mock('../useLibraryViewState', () => ({
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

  expect(result.current.importStatus).toBeNull();
  expect(result.current.loading).toBe(false);
  expect(result.current.query).toBe('');
  expect(result.current.searchOpen).toBe(false);
  expect(result.current.menuModalProps).toEqual({ visible: false });
  expect(result.current.tabContentProps).toEqual({ activeTab: 'tracks' });
  expect(result.current.tabsProps).toEqual({
    activeTab: 'tracks',
    onChangeTab: expect.any(Function),
  });
  expect(result.current.topBarProps).toEqual({
    onOpenMenu: expect.any(Function),
    onToggleSearch: expect.any(Function),
  });
});
