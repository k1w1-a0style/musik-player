import type { LibraryImportStatusProps } from '../components/LibraryImportStatus';
import type { LibraryMenuModalProps } from '../components/LibraryMenuModal';
import type { LibrarySearchBarProps } from '../components/LibrarySearchBar';
import type { LibraryScreenContentProps } from '../components/LibraryScreenContent';
import type { LibraryTabContentProps } from '../components/LibraryTabContent';
import type { LibraryAlbumViewMode } from '../components/LibraryAlbumViewToggle';
import type { LibraryTabsProps } from '../components/LibraryTabs';
import type { LibraryTopBarProps } from '../components/LibraryTopBar';
import type { Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import type { LibraryTab } from './libraryTabs';
import type { LibraryGroupItem } from './libraryPresentation';
import type { LibraryPlaylistItem } from './libraryPlaylists';

export interface LibraryTopBarPropsBuilderOptions {
  openMenu: () => void;
  toggleSearch: () => void;
}

export interface LibraryTabsPropsBuilderOptions {
  activeTab: LibraryTab;
  setActiveTab: (tab: LibraryTab) => void;
}

export interface LibrarySearchBarPropsBuilderOptions {
  query: string;
  setQuery: (query: string) => void;
}

export interface LibraryImportStatusPropsBuilderOptions {
  importStatus: string | null;
}

export interface LibraryScreenVisibilityPropsBuilderOptions {
  loading: boolean;
  searchOpen: boolean;
}

export interface LibraryTabContentPropsBuilderOptions {
  activeTab: LibraryTab;
  activeFolders: number;
  albumGroups: LibraryGroupItem[];
  albumViewMode: LibraryAlbumViewMode;
  artistGroups: LibraryGroupItem[];
  emptyMessage: string;
  genreGroups: LibraryGroupItem[];
  getSongItemLayout: LibraryTabContentProps['getSongItemLayout'];
  onPlayActiveList: () => void;
  onShuffle: () => void;
  onToggleAlbumView: () => void;
  playlistItems: LibraryPlaylistItem[];
  renderAlbumTile: LibraryTabContentProps['renderAlbumTile'];
  renderFolderItem: LibraryTabContentProps['renderFolderItem'];
  renderGroupItem: LibraryTabContentProps['renderGroupItem'];
  renderPlaylistItem: LibraryTabContentProps['renderPlaylistItem'];
  renderSongItem: LibraryTabContentProps['renderSongItem'];
  scanFolders: ScanFolder[];
  songKeyExtractor: (item: Song) => string;
  songsForActiveList: Song[];
}

export interface LibraryMenuModalPropsBuilderOptions {
  activeFolders: number;
  closeMenu: () => void;
  importFromDevice: () => void;
  isReady: boolean;
  loading: boolean;
  menuOpen: boolean;
  onAddScanFolder: () => void;
  openSettings: () => void;
  refreshMetadataFromFiles: () => void;
  showScanFolders: () => void;
  songsCount: number;
}

export const buildLibraryTopBarProps = ({ openMenu, toggleSearch }: LibraryTopBarPropsBuilderOptions): LibraryTopBarProps => ({
  onOpenMenu: openMenu,
  onToggleSearch: toggleSearch,
});

export const buildLibraryTabsProps = ({ activeTab, setActiveTab }: LibraryTabsPropsBuilderOptions): LibraryTabsProps => ({
  activeTab,
  onChangeTab: setActiveTab,
});

export const buildLibrarySearchBarProps = ({ query, setQuery }: LibrarySearchBarPropsBuilderOptions): LibrarySearchBarProps => ({
  autoFocus: true,
  onChangeText: setQuery,
  value: query,
});

export const buildLibraryImportStatusProps = ({ importStatus }: LibraryImportStatusPropsBuilderOptions): LibraryImportStatusProps => ({
  status: importStatus,
});

export const buildLibraryScreenVisibilityProps = ({ loading, searchOpen }: LibraryScreenVisibilityPropsBuilderOptions): Pick<LibraryScreenContentProps, 'showImportStatus' | 'showSearchBar'> => ({
  showImportStatus: loading,
  showSearchBar: searchOpen,
});

export const buildLibraryTabContentProps = (options: LibraryTabContentPropsBuilderOptions): LibraryTabContentProps => ({
  activeTab: options.activeTab,
  activeFolders: options.activeFolders,
  albumGroups: options.albumGroups,
  albumViewMode: options.albumViewMode,
  artistGroups: options.artistGroups,
  emptyMessage: options.emptyMessage,
  genreGroups: options.genreGroups,
  getSongItemLayout: options.getSongItemLayout,
  onPlayActiveList: options.onPlayActiveList,
  onShuffle: options.onShuffle,
  onToggleAlbumView: options.onToggleAlbumView,
  playlistItems: options.playlistItems,
  renderAlbumTile: options.renderAlbumTile,
  renderFolderItem: options.renderFolderItem,
  renderGroupItem: options.renderGroupItem,
  renderPlaylistItem: options.renderPlaylistItem,
  renderSongItem: options.renderSongItem,
  scanFolders: options.scanFolders,
  songKeyExtractor: options.songKeyExtractor,
  songsForActiveList: options.songsForActiveList,
});

export const buildLibraryMenuModalProps = (options: LibraryMenuModalPropsBuilderOptions): LibraryMenuModalProps => ({
  visible: options.menuOpen,
  loading: options.loading,
  isReady: options.isReady,
  hasSongs: options.songsCount > 0,
  activeFolders: options.activeFolders,
  onClose: options.closeMenu,
  onImport: options.importFromDevice,
  onRefreshMetadata: options.refreshMetadataFromFiles,
  onAddFolder: options.onAddScanFolder,
  onShowFolders: options.showScanFolders,
  onOpenSettings: options.openSettings,
});
