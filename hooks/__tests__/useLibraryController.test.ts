import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { useLibraryController } from '../useLibraryController';
import type { useLibraryMusicContext } from '../../contexts/MusicContext';
import type { UseLibraryAlertsResult } from '../useLibraryAlerts';
import type { UseLibraryComponentPropsResult } from '../useLibraryComponentProps';
import type { UseLibraryImportActionsResult } from '../useLibraryImportActions';
import type { UseLibraryMenuActionsResult } from '../useLibraryMenuActions';
import type { UseLibraryMetadataRefreshActionsResult } from '../useLibraryMetadataRefreshActions';
import type { UseLibraryNavigationActionsResult } from '../useLibraryNavigationActions';
import type { UseLibraryPlaybackActionsResult } from '../useLibraryPlaybackActions';
import type { UseLibraryRenderersResult } from '../useLibraryRenderers';
import type { UseLibraryScanFolderActionsResult } from '../useLibraryScanFolderActions';
import type { UseLibraryScreenStateResult } from '../useLibraryScreenState';
import type { UseLibraryStoredStateResult } from '../useLibraryStoredState';
import type { UseLibraryViewStateResult } from '../useLibraryViewState';
import { useLibraryComponentProps } from '../useLibraryComponentProps';
import { useLibraryImportActions } from '../useLibraryImportActions';
import { useLibraryMenuActions } from '../useLibraryMenuActions';
import { useLibraryMetadataRefreshActions } from '../useLibraryMetadataRefreshActions';
import { useLibraryPlaybackActions } from '../useLibraryPlaybackActions';
import { useLibraryRenderers } from '../useLibraryRenderers';
import { useLibraryScanFolderActions } from '../useLibraryScanFolderActions';
import { useLibraryStoredState } from '../useLibraryStoredState';
import { useLibraryViewState } from '../useLibraryViewState';

type MockLibraryMusicContext = ReturnType<typeof useLibraryMusicContext>;

const fn = jest.fn();
const asyncFn = jest.fn(async () => undefined);
const elementFn = jest.fn(() => React.createElement(React.Fragment));

const mockMusicContext: MockLibraryMusicContext = {
  songs: [],
  setSongs: fn,
  currentSong: null,
  playSong: asyncFn,
  isReady: true,
  isPlaying: false,
  updateSongMetadata: fn,
  applySongMetadataPatches: fn,
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

const mockMetadataRefreshActions: UseLibraryMetadataRefreshActionsResult = {
  refreshMetadataFromFiles: asyncFn,
};

const mockNavigationActions: UseLibraryNavigationActionsResult = {
  openTrackInfo: fn,
  openEqualizer: fn,
};

const mockPlaybackActions: UseLibraryPlaybackActionsResult = {
  handlePlayActiveList: fn,
  handleShufflePress: fn,
  toggleAlbumView: fn,
};

const mockRenderers: UseLibraryRenderersResult = {
  getSongItemLayout: jest.fn((_, index: number) => ({ length: 62, offset: 62 * index, index })),
  handleSongPress: fn,
  renderAlbumTile: elementFn,
  renderFolderItem: elementFn,
  renderGroupItem: elementFn,
  renderPlaylistItem: elementFn,
  renderSongItem: elementFn,
  songKeyExtractor: jest.fn(item => item.id),
};

const mockScanFolderActions: UseLibraryScanFolderActionsResult = {
  showScanFolders: fn,
  onAddScanFolder: asyncFn,
  persistChangedFolderUpdates: asyncFn,
  removeFolder: asyncFn,
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
    onOpenEqualizer: fn,
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
    sortMode: 'alphabet',
    onCycleSortMode: fn,
    songViewMode: 'list',
    onCycleSongViewMode: fn,
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
  useLibraryMetadataRefreshActions: jest.fn(() => mockMetadataRefreshActions),
}));

jest.mock('../useLibraryNavigationActions', () => ({
  useLibraryNavigationActions: jest.fn(() => mockNavigationActions),
}));

jest.mock('../useLibraryPlaybackActions', () => ({
  useLibraryPlaybackActions: jest.fn(() => mockPlaybackActions),
}));

jest.mock('../useLibraryRenderers', () => ({
  useLibraryRenderers: jest.fn(() => mockRenderers),
}));

jest.mock('../useLibraryScanFolderActions', () => ({
  useLibraryScanFolderActions: jest.fn(() => mockScanFolderActions),
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

jest.mock('../useLibrarySortMode', () => ({
  useLibrarySortMode: jest.fn(() => ({ sortMode: 'alphabet', setSortMode: jest.fn(), cycleSortMode: jest.fn() })),
}));

jest.mock('../useLibrarySongViewMode', () => ({
  useLibrarySongViewMode: jest.fn(() => ({ viewMode: 'list', setViewMode: jest.fn(), cycleViewMode: jest.fn() })),
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

test('wires controller state, actions, renderers, playback, and props without changing the public props API', () => {
  renderHook(() => useLibraryController());

  expect(useLibraryStoredState).toHaveBeenCalledWith('tracks');
  expect(useLibraryViewState).toHaveBeenCalledWith({
    activeTab: 'tracks',
    favoriteIds: [],
    isReady: true,
    playlists: [],
    query: '',
    scanFolders: [],
    songs: [],
  });
  expect(useLibraryMenuActions).toHaveBeenCalledWith({
    setMenuOpen: mockScreenState.setMenuOpen,
    setSearchOpen: mockScreenState.setSearchOpen,
    showAlert: mockAlerts.showAlert,
  });
  expect(useLibraryScanFolderActions).toHaveBeenCalledWith({
    scanFolders: [],
    setActiveTab: mockScreenState.setActiveTab,
    setMenuOpen: mockScreenState.setMenuOpen,
    setScanFolders: mockStoredState.setScanFolders,
    showAlert: mockAlerts.showAlert,
  });
  expect(useLibraryImportActions).toHaveBeenCalledWith({
    persistChangedFolderUpdates: mockScanFolderActions.persistChangedFolderUpdates,
    scanFolders: [],
    setActiveTab: mockScreenState.setActiveTab,
    setImportStatus: mockScreenState.setImportStatus,
    setLoading: mockScreenState.setLoading,
    setMenuOpen: mockScreenState.setMenuOpen,
    setSongs: mockMusicContext.setSongs,
    showAlert: mockAlerts.showAlert,
    songs: [],
  });
  expect(useLibraryMetadataRefreshActions).toHaveBeenCalledWith({
    setImportStatus: mockScreenState.setImportStatus,
    setLoading: mockScreenState.setLoading,
    setMenuOpen: mockScreenState.setMenuOpen,
    setSongs: mockMusicContext.setSongs,
    applySongMetadataPatches: mockMusicContext.applySongMetadataPatches,
    showAlert: mockAlerts.showAlert,
    songs: [],
  });
  expect(useLibraryRenderers).toHaveBeenCalledWith({
    currentSongId: null,
    filteredSongs: [],
    isPlaying: false,
    onOpenTrackInfo: mockNavigationActions.openTrackInfo,
    playPlaylist: mockMusicContext.playPlaylist,
    playSong: mockMusicContext.playSong,
    removeFolder: mockScanFolderActions.removeFolder,
    songViewMode: 'list',
  });
  expect(useLibraryPlaybackActions).toHaveBeenCalledWith({
    handleSongPress: mockRenderers.handleSongPress,
    playSong: mockMusicContext.playSong,
    setAlbumViewMode: mockScreenState.setAlbumViewMode,
    songsForActiveList: [],
  });
  expect(useLibraryComponentProps).toHaveBeenCalledWith(expect.objectContaining({
    activeTab: 'tracks',
    importStatus: null,
    loading: false,
    menuOpen: false,
    query: '',
    searchOpen: false,
    songsCount: 0,
  }));
  expect(Object.keys(jest.mocked(useLibraryComponentProps).mock.calls[0][0]).some(key => key.toLowerCase().includes('visualizer') || key.toLowerCase().includes('fft'))).toBe(false);
});
