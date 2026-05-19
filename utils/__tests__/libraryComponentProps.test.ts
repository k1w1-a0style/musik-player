import {
  buildLibraryImportStatusProps,
  buildLibraryMenuModalProps,
  buildLibraryScreenVisibilityProps,
  buildLibrarySearchBarProps,
  buildLibraryTabContentProps,
  buildLibraryTabsProps,
  buildLibraryTopBarProps,
  type LibraryImportStatusPropsBuilderOptions,
  type LibraryMenuModalPropsBuilderOptions,
  type LibraryScreenVisibilityPropsBuilderOptions,
  type LibrarySearchBarPropsBuilderOptions,
  type LibraryTabContentPropsBuilderOptions,
  type LibraryTabsPropsBuilderOptions,
  type LibraryTopBarPropsBuilderOptions,
} from '../libraryComponentProps';
import type { Song } from '../../types/Song';
import type { ScanFolder } from '../../types/ScanFolder';
import type { LibraryGroupItem } from '../libraryPresentation';
import type { LibraryPlaylistItem } from '../libraryPlaylists';

test('buildLibraryTopBarProps returns top bar props', () => {
  const openMenu = jest.fn();
  const toggleSearch = jest.fn();
  const options: LibraryTopBarPropsBuilderOptions = { openMenu, toggleSearch };

  expect(buildLibraryTopBarProps(options)).toEqual({
    onOpenMenu: openMenu,
    onToggleSearch: toggleSearch,
  });
});

test('buildLibraryTabsProps returns tabs props', () => {
  const setActiveTab = jest.fn();
  const options: LibraryTabsPropsBuilderOptions = { activeTab: 'albums', setActiveTab };

  expect(buildLibraryTabsProps(options)).toEqual({
    activeTab: 'albums',
    onChangeTab: setActiveTab,
  });
});

test('buildLibrarySearchBarProps returns search bar props', () => {
  const setQuery = jest.fn();
  const options: LibrarySearchBarPropsBuilderOptions = { query: 'abc', setQuery };

  expect(buildLibrarySearchBarProps(options)).toEqual({
    autoFocus: true,
    onChangeText: setQuery,
    value: 'abc',
  });
});

test('buildLibraryImportStatusProps returns import status props', () => {
  const options: LibraryImportStatusPropsBuilderOptions = { importStatus: 'Import läuft' };

  expect(buildLibraryImportStatusProps(options)).toEqual({ status: 'Import läuft' });
});

test('buildLibraryScreenVisibilityProps returns screen content visibility props', () => {
  const options: LibraryScreenVisibilityPropsBuilderOptions = { loading: true, searchOpen: false };

  expect(buildLibraryScreenVisibilityProps(options)).toEqual({
    showImportStatus: true,
    showSearchBar: false,
  });
});

test('buildLibraryTabContentProps returns tab content props', () => {
  const fn = jest.fn();
  const options: LibraryTabContentPropsBuilderOptions = {
    activeTab: 'tracks',
    activeFolders: 2,
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
  };

  const props = buildLibraryTabContentProps(options);

  expect(props.activeTab).toBe('tracks');
  expect(props.activeFolders).toBe(2);
  expect(props.emptyMessage).toBe('Leer');
  expect(props.getSongItemLayout).toBe(fn);
  expect(props.onShuffle).toBe(fn);
});

test('buildLibraryTabContentProps preserves list and renderer references', () => {
  const song: Song = { id: 's1', title: 'Song', artist: 'Artist' };
  const folder: ScanFolder = {
    id: 'folder-1',
    name: 'Music',
    uri: 'file:///music',
    addedAt: 1,
    enabled: true,
  };
  const group: LibraryGroupItem = {
    id: 'album:One',
    title: 'One',
    subtitle: '1 Track',
    songs: [song],
  };
  const playlist: LibraryPlaylistItem = {
    id: 'playlist-1',
    name: 'Playlist',
    songs: [song],
    validCount: 1,
    totalCount: 1,
  };
  const fn = jest.fn();
  const songKeyExtractor = jest.fn((item: Song) => item.id);

  const props = buildLibraryTabContentProps({
    activeTab: 'playlists',
    activeFolders: 1,
    albumGroups: [group],
    albumViewMode: 'list',
    artistGroups: [group],
    emptyMessage: 'Leer',
    genreGroups: [group],
    getSongItemLayout: fn,
    onPlayActiveList: fn,
    onShuffle: fn,
    onToggleAlbumView: fn,
    playlistItems: [playlist],
    renderAlbumTile: fn,
    renderFolderItem: fn,
    renderGroupItem: fn,
    renderPlaylistItem: fn,
    renderSongItem: fn,
    scanFolders: [folder],
    songKeyExtractor,
    songsForActiveList: [song],
  });

  expect(props.albumGroups).toEqual([group]);
  expect(props.artistGroups).toEqual([group]);
  expect(props.genreGroups).toEqual([group]);
  expect(props.playlistItems).toEqual([playlist]);
  expect(props.scanFolders).toEqual([folder]);
  expect(props.songsForActiveList).toEqual([song]);
  expect(props.renderPlaylistItem).toBe(fn);
  expect(props.songKeyExtractor(song)).toBe('s1');
  expect(songKeyExtractor).toHaveBeenCalledWith(song);
});

test('buildLibraryMenuModalProps returns menu modal props', () => {
  const fn = jest.fn();
  const options: LibraryMenuModalPropsBuilderOptions = {
    activeFolders: 3,
    closeMenu: fn,
    importFromDevice: fn,
    isReady: true,
    loading: false,
    menuOpen: true,
    onAddScanFolder: fn,
    openSettings: fn,
    refreshMetadataFromFiles: fn,
    showScanFolders: fn,
    songsCount: 5,
  };

  const props = buildLibraryMenuModalProps(options);

  expect(props.visible).toBe(true);
  expect(props.loading).toBe(false);
  expect(props.isReady).toBe(true);
  expect(props.hasSongs).toBe(true);
  expect(props.activeFolders).toBe(3);
  expect(props.onClose).toBe(fn);
  expect(props.onImport).toBe(fn);
  expect(props.onRefreshMetadata).toBe(fn);
  expect(props.onAddFolder).toBe(fn);
  expect(props.onShowFolders).toBe(fn);
  expect(props.onOpenSettings).toBe(fn);
});

test('buildLibraryMenuModalProps marks empty library when song count is zero', () => {
  const fn = jest.fn();
  const options: LibraryMenuModalPropsBuilderOptions = {
    activeFolders: 0,
    closeMenu: fn,
    importFromDevice: fn,
    isReady: false,
    loading: true,
    menuOpen: false,
    onAddScanFolder: fn,
    openSettings: fn,
    refreshMetadataFromFiles: fn,
    showScanFolders: fn,
    songsCount: 0,
  };

  const props = buildLibraryMenuModalProps(options);

  expect(props.visible).toBe(false);
  expect(props.hasSongs).toBe(false);
});