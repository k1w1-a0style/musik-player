import { renderHook } from '@testing-library/react-native';
import { useLibraryController } from '../useLibraryController';
import type { useLibraryMusicContext } from '../../contexts/MusicContext';
import type { UseLibraryAlertsResult } from '../useLibraryAlerts';
import type { UseLibraryComponentPropsResult } from '../useLibraryComponentProps';
import type { UseLibraryImportActionsResult } from '../useLibraryImportActions';
import type { UseLibraryMenuActionsResult } from '../useLibraryMenuActions';
import type { UseLibraryScreenStateResult } from '../useLibraryScreenState';
import type { UseLibraryStoredStateResult } from '../useLibraryStoredState';
import type { UseLibraryViewStateResult } from '../useLibraryViewState';

type MockLibraryMusicContext = ReturnType<typeof useLibraryMusicContext>;

const fn = jest.fn();
const asyncFn = jest.fn(async () => undefined);

const mockMusicContext: MockLibraryMusicContext = {
  songs: [],
  setSongs: fn,
  currentSong: null,
  playSong: asyncFn,
  isReady: true,
  isPlaying: false,
  updateSongMetadata: fn,
  playlists: [],
  playPlaylist: asyncFn,
};

const mockAlerts: UseLibraryAlertsResult = {
  showAlert: fn,
};

const mockImportActions: UseLibraryImportActionsResult = {
  importFromDevice: asyncFn,
};

const mockMenuActions: UseLibraryMenuActionsResult = {
  closeMenu: fn,
  openMenu: fn,
  openSettings: fn,
  toggleSearch: fn,
};

const mockComponentProps: UseLibraryComponentPropsResult = {
  importStatusProps: { status: null },
  menuModalProps: {
    visible: false,
    loading: false,
    isReady: true,
    hasSongs: false,
    activeFolders: 0,
    onClose: fn,
    onImport: fn,
    onRefreshMetadata: fn,
    onAddFolder: fn,
    onShowFolders: fn,
    onOpenSettings: fn,
  },
  searchBarProps: {
    autoFocus: true,
    onChangeText: fn,
    value: '',
  },
  showImportStatus: false,
  showSearchBar: false,
  tabContentProps: {
    activeTab: 'tracks',
    activeFolders: 0,
    albumGroups: [],
    albumViewMode: 'grid',
    artistGroups: [],
    emptyMessage: 'Leer',
    genreGroups: [],
    getSongItemLayout: fn,
    onPlayActiveList: fn,
    onShuffle: fn,
    onToggleAlbumView: fn,
    playlistItems: [],
    renderAlbumTile: fn,
    renderFolderItem: fn,
    renderGroupItem: fn,
    renderPlaylistItem: fn,
    renderSongItem: fn,
    scanFolders: [],
    songKeyExtractor: item => item.id,
    songsForActiveList: [],
  },
  tabsProps: {
    activeTab: 'tracks',
    onChangeTab: fn,
  },
  topBarProps: {
    onOpenMenu: fn,
    onToggleSearch: fn,
  },
};

const mockScreenState: UseLibraryScreenStateResult = {
  activeTab: 'tracks',
  albumViewMode: 'grid',
  importStatus: null,
  loading: false,
  menuOpen: false,
  query: '',
  searchOpen: false,
  setActiveTab: fn,
  setAlbumViewMode: fn,
  setImportStatus: fn,
  setLoading: fn,
  setMenuOpen: fn,
  setQuery: fn,
  setSearchOpen: fn,
};

const mockStoredState: UseLibraryStoredStateResult = {
  scanFolders: [],
  setScanFolders: fn,
  favoriteIds: [],
  setFavoriteIds: fn,
};

const mockViewState: UseLibraryViewStateResult = {
  activeFolders: 0,
  albumGroups: [],
  artistGroups: [],
  displayedSongs: [],
  emptyMessage: 'Leer',
  favoriteSongs: [],
  filteredSongs: [],
  genreGroups: [],
  playlistItems: [],
  songsForActiveList: [],
};

jest.mock('../../contexts/MusicContext', () => ({
  useLibraryMusicContext: jest.fn(() => mockMusicContext),
}));

jest.mock('../useLibraryAlerts', () => ({
  useLibraryAlerts: jest.fn(() => mockAlerts),
}));

jest.mock('../useLibraryComponentProps', () => ({
  useLibraryComponentProps: jest.fn(() => mockComponentProps),
}));

jest.mock('../useLibraryImportActions', () => ({
  useLibraryImportActions: jest.fn(() => mockImportActions),
}));

jest.mock('../useLibraryMenuActions', () => ({
  useLibraryMenuActions: jest.fn(() => mockMenuActions),
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
  useLibraryScreenState: jest.fn(() => mockScreenState),
}));

jest.mock('../useLibraryStoredState', () => ({
  useLibraryStoredState: jest.fn(() => mockStoredState),
}));

jest.mock('../useLibraryViewState', () => ({
  useLibraryViewState: jest.fn(() => mockViewState),
}));

test('returns library screen props from composed hooks', () => {
  const { result } = renderHook(() => useLibraryController());

  expect(result.current.importStatusProps).toEqual({ status: null });
  expect(result.current.showImportStatus).toBe(false);
  expect(result.current.searchBarProps).toEqual({
    autoFocus: true,
    onChangeText: expect.any(Function),
    value: '',
  });
  expect(result.current.showSearchBar).toBe(false);
  expect(result.current.menuModalProps).toEqual(mockComponentProps.menuModalProps);
  expect(result.current.tabContentProps).toEqual(mockComponentProps.tabContentProps);
  expect(result.current.tabsProps).toEqual({
    activeTab: 'tracks',
    onChangeTab: expect.any(Function),
  });
  expect(result.current.topBarProps).toEqual({
    onOpenMenu: expect.any(Function),
    onToggleSearch: expect.any(Function),
  });
});
