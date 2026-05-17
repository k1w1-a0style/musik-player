import { buildLibraryMenuModalProps, buildLibraryTabContentProps } from '../libraryComponentProps';

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
