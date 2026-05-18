import { renderHook } from '@testing-library/react-native';
import { useLibraryComponentProps } from '../useLibraryComponentProps';

const fn = jest.fn();

const baseOptions = {
  activeFolders: 1,
  activeTab: 'tracks' as const,
  albumGroups: [],
  albumViewMode: 'grid' as const,
  artistGroups: [],
  closeMenu: fn,
  emptyMessage: 'Leer',
  genreGroups: [],
  getSongItemLayout: fn,
  importFromDevice: fn,
  importStatus: 'Import läuft',
  isReady: true,
  loading: false,
  menuOpen: true,
  onAddScanFolder: fn,
  onPlayActiveList: fn,
  onShuffle: fn,
  onToggleAlbumView: fn,
  openMenu: fn,
  openSettings: fn,
  playlistItems: [],
  query: 'abc',
  refreshMetadataFromFiles: fn,
  renderAlbumTile: fn,
  renderFolderItem: fn,
  renderGroupItem: fn,
  renderPlaylistItem: fn,
  renderSongItem: fn,
  scanFolders: [],
  searchOpen: true,
  setActiveTab: fn,
  setQuery: fn,
  showScanFolders: fn,
  songKeyExtractor: (item: { id: string }) => item.id,
  songsCount: 2,
  songsForActiveList: [],
  toggleSearch: fn,
};

test('returns library component props', () => {
  const { result } = renderHook(() => useLibraryComponentProps(baseOptions));

  expect(result.current.showImportStatus).toBe(false);
  expect(result.current.showSearchBar).toBe(true);
  expect(result.current.topBarProps).toEqual({
    onOpenMenu: fn,
    onToggleSearch: fn,
  });
  expect(result.current.tabsProps).toEqual({
    activeTab: 'tracks',
    onChangeTab: fn,
  });
  expect(result.current.searchBarProps).toEqual({
    autoFocus: true,
    onChangeText: fn,
    value: 'abc',
  });
  expect(result.current.importStatusProps).toEqual({ status: 'Import läuft' });
  expect(result.current.tabContentProps.activeTab).toBe('tracks');
  expect(result.current.tabContentProps.activeFolders).toBe(1);
  expect(result.current.tabContentProps.emptyMessage).toBe('Leer');
  expect(result.current.tabContentProps.onShuffle).toBe(fn);
  expect(result.current.menuModalProps.visible).toBe(true);
  expect(result.current.menuModalProps.hasSongs).toBe(true);
  expect(result.current.menuModalProps.onClose).toBe(fn);
});
