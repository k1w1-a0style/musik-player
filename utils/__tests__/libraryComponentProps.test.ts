import {
  buildLibraryImportStatusProps,
  buildLibraryMenuModalProps,
  buildLibraryScreenVisibilityProps,
  buildLibrarySearchBarProps,
  buildLibraryTabContentProps,
  buildLibraryTabsProps,
  buildLibraryTopBarProps,
} from '../libraryComponentProps';
import type { LibraryTabContentPropsBuilderOptions } from '../libraryComponentProps';
import type { Song } from '../../types/Song';
import type { ScanFolder } from '../../types/ScanFolder';
import type { LibraryGroupItem } from '../libraryPresentation';
import type { LibraryPlaylistItem } from '../libraryPlaylists';

const fn = jest.fn();

const makeTabOptions = (): LibraryTabContentPropsBuilderOptions => ({
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
  newPlaylistName: '',
  onChangePlaylistName: fn,
  onCreatePlaylist: fn,
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
  onSelectSortMode: fn,
  songViewMode: 'list',
  onCycleSongViewMode: fn,
});

test('buildLibraryTopBarProps returns top bar props', () => {
  expect(buildLibraryTopBarProps({ openMenu: fn, toggleSearch: fn })).toEqual({
    onOpenMenu: fn,
    onToggleSearch: fn,
  });
});

test('buildLibraryTabsProps returns tabs props', () => {
  expect(buildLibraryTabsProps({ activeTab: 'albums', setActiveTab: fn })).toEqual({
    activeTab: 'albums',
    onChangeTab: fn,
  });
});

test('buildLibrarySearchBarProps returns search bar props', () => {
  expect(buildLibrarySearchBarProps({ query: 'abc', setQuery: fn })).toEqual({
    autoFocus: true,
    onChangeText: fn,
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

test('buildLibraryTabContentProps returns tab content props and direct sort selector', () => {
  const props = buildLibraryTabContentProps(makeTabOptions());

  expect(props.activeTab).toBe('tracks');
  expect(props.activeFolders).toBe(2);
  expect(props.emptyMessage).toBe('Leer');
  expect(props.getSongItemLayout).toBe(fn);
  expect(props.onShuffle).toBe(fn);
  expect(props.onSelectSortMode).toBe(fn);
});

test('buildLibraryTabContentProps preserves list and renderer references', () => {
  const song: Song = { id: 's1', title: 'Song', artist: 'Artist' };
  const folder: ScanFolder = { id: 'folder-1', name: 'Music', uri: 'file:///music', addedAt: 1, enabled: true };
  const group: LibraryGroupItem = { id: 'album:One', title: 'One', subtitle: '1 Titel', songs: [song] };
  const playlist: LibraryPlaylistItem = { id: 'playlist-1', name: 'Playlist', songs: [song], validCount: 1, totalCount: 1 };
  const songKeyExtractor = jest.fn((item: Song) => item.id);

  const props = buildLibraryTabContentProps({
    ...makeTabOptions(),
    activeTab: 'playlists',
    activeFolders: 1,
    albumGroups: [group],
    albumViewMode: 'list',
    artistGroups: [group],
    genreGroups: [group],
    playlistItems: [playlist],
    scanFolders: [folder],
    songKeyExtractor,
    songsForActiveList: [song],
    sortMode: 'year',
    songViewMode: 'gridLarge',
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
  const props = buildLibraryMenuModalProps({
    activeFolders: 3,
    closeMenu: fn,
    importFromDevice: fn,
    isReady: true,
    loading: false,
    menuOpen: true,
    onAddScanFolder: fn,
    openSettings: fn,
    openEqualizer: fn,
    refreshMetadataFromFiles: fn,
    showScanFolders: fn,
    songsCount: 5,
  });

  expect(props.visible).toBe(true);
  expect(props.hasSongs).toBe(true);
  expect(props.onOpenSettings).toBe(fn);
  expect(props.onOpenEqualizer).toBe(fn);
});

test('buildLibraryMenuModalProps marks empty library when song count is zero', () => {
  const props = buildLibraryMenuModalProps({
    activeFolders: 0,
    closeMenu: fn,
    importFromDevice: fn,
    isReady: false,
    loading: true,
    menuOpen: false,
    onAddScanFolder: fn,
    openSettings: fn,
    openEqualizer: fn,
    refreshMetadataFromFiles: fn,
    showScanFolders: fn,
    songsCount: 0,
  });

  expect(props.visible).toBe(false);
  expect(props.hasSongs).toBe(false);
});
