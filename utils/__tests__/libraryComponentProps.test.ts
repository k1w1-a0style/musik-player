import {
  buildLibraryImportStatusProps,
  buildLibraryMenuModalProps,
  buildLibraryScreenVisibilityProps,
  buildLibrarySearchBarProps,
  buildLibraryTabContentProps,
  buildLibraryTabsProps,
  buildLibraryTopBarProps,
} from '../libraryComponentProps';

test('buildLibraryTopBarProps returns top bar props', () => {
  const openMenu = jest.fn();
  const toggleSearch = jest.fn();

  expect(buildLibraryTopBarProps({ openMenu, toggleSearch })).toEqual({
    onOpenMenu: openMenu,
    onToggleSearch: toggleSearch,
  });
});

test('buildLibraryTabsProps returns tabs props', () => {
  const setActiveTab = jest.fn();

  expect(buildLibraryTabsProps({ activeTab: 'albums', setActiveTab })).toEqual({
    activeTab: 'albums',
    onChangeTab: setActiveTab,
  });
});

test('buildLibrarySearchBarProps returns search bar props', () => {
  const setQuery = jest.fn();

  expect(buildLibrarySearchBarProps({ query: 'abc', setQuery })).toEqual({
    autoFocus: true,
    onChangeText: setQuery,
    value: 'abc',
  });
});

test('buildLibraryImportStatusProps returns import status props', () => {
  expect(buildLibraryImportStatusProps({ importStatus: 'Import läuft' })).toEqual({ status: 'Import läuft' });
});

test('buildLibraryScreenVisibilityProps returns screen content visibility props', () => {
  expect(buildLibraryScreenVisibilityProps({ loading: true, searchOpen: false })).toEqual({
    showImportStatus: true,
    showSearchBar: false,
  });
});

test('buildLibraryTabContentProps returns tab content props', () => {
  const fn = jest.fn();
  const props = buildLibraryTabContentProps({
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
  });

  expect(props.activeTab).toBe('tracks');
  expect(props.activeFolders).toBe(2);
  expect(props.emptyMessage).toBe('Leer');
  expect(props.getSongItemLayout).toBe(fn);
  expect(props.onShuffle).toBe(fn);
});

test('buildLibraryMenuModalProps returns menu modal props', () => {
  const fn = jest.fn();
  const props = buildLibraryMenuModalProps({
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
  });

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
  const props = buildLibraryMenuModalProps({
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
  });

  expect(props.visible).toBe(false);
  expect(props.hasSongs).toBe(false);
});
