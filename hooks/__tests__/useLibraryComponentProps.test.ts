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
  handlePlayActiveList: fn,
  handleShufflePress: fn,
  importFromDevice: fn,
  isReady: true,
  loading: false,
  menuOpen: true,
  onAddScanFolder: fn,
  openSettings: fn,
  playlistItems: [],
  refreshMetadataFromFiles: fn,
  renderAlbumTile: fn,
  renderFolderItem: fn,
  renderGroupItem: fn,
  renderPlaylistItem: fn,
  renderSongItem: fn,
  scanFolders: [],
  showScanFolders: fn,
  songKeyExtractor: (item: { id: string }) => item.id,
  songsCount: 2,
  songsForActiveList: [],
  toggleAlbumView: fn,
};

test('returns tab content and menu modal props', () => {
  const { result } = renderHook(() => useLibraryComponentProps(baseOptions));

  expect(result.current.tabContentProps.activeTab).toBe('tracks');
  expect(result.current.tabContentProps.activeFolders).toBe(1);
  expect(result.current.tabContentProps.emptyMessage).toBe('Leer');
  expect(result.current.tabContentProps.onShuffle).toBe(fn);
  expect(result.current.menuModalProps.visible).toBe(true);
  expect(result.current.menuModalProps.hasSongs).toBe(true);
  expect(result.current.menuModalProps.onClose).toBe(fn);
});
