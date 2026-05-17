import { useMemo } from 'react';
import type { LibraryImportStatusProps } from '../components/LibraryImportStatus';
import type { LibraryMenuModalProps } from '../components/LibraryMenuModal';
import type { LibrarySearchBarProps } from '../components/LibrarySearchBar';
import type { LibraryTabContentProps } from '../components/LibraryTabContent';
import type { LibraryAlbumViewMode } from '../components/LibraryAlbumViewToggle';
import type { LibraryTabsProps } from '../components/LibraryTabs';
import type { LibraryTopBarProps } from '../components/LibraryTopBar';
import type { Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import { buildLibraryMenuModalProps, buildLibraryTabContentProps } from '../utils/libraryComponentProps';
import type { LibraryGroupItem } from '../utils/libraryPresentation';
import type { LibraryPlaylistItem } from '../utils/libraryPlaylists';
import type { LibraryTab } from '../utils/libraryTabs';

interface UseLibraryComponentPropsOptions {
  activeFolders: number;
  activeTab: LibraryTab;
  albumGroups: LibraryGroupItem[];
  albumViewMode: LibraryAlbumViewMode;
  artistGroups: LibraryGroupItem[];
  closeMenu: () => void;
  emptyMessage: string;
  genreGroups: LibraryGroupItem[];
  getSongItemLayout: LibraryTabContentProps['getSongItemLayout'];
  handlePlayActiveList: () => void;
  handleShufflePress: () => void;
  importFromDevice: () => void;
  importStatus: string | null;
  isReady: boolean;
  loading: boolean;
  menuOpen: boolean;
  onAddScanFolder: () => void;
  openMenu: () => void;
  openSettings: () => void;
  playlistItems: LibraryPlaylistItem[];
  query: string;
  refreshMetadataFromFiles: () => void;
  renderAlbumTile: LibraryTabContentProps['renderAlbumTile'];
  renderFolderItem: LibraryTabContentProps['renderFolderItem'];
  renderGroupItem: LibraryTabContentProps['renderGroupItem'];
  renderPlaylistItem: LibraryTabContentProps['renderPlaylistItem'];
  renderSongItem: LibraryTabContentProps['renderSongItem'];
  scanFolders: ScanFolder[];
  setActiveTab: (tab: LibraryTab) => void;
  setQuery: (query: string) => void;
  showScanFolders: () => void;
  songKeyExtractor: (item: Song) => string;
  songsCount: number;
  songsForActiveList: Song[];
  toggleAlbumView: () => void;
  toggleSearch: () => void;
}

interface UseLibraryComponentPropsResult {
  importStatusProps: LibraryImportStatusProps;
  menuModalProps: LibraryMenuModalProps;
  searchBarProps: LibrarySearchBarProps;
  tabContentProps: LibraryTabContentProps;
  tabsProps: LibraryTabsProps;
  topBarProps: LibraryTopBarProps;
}

export const useLibraryComponentProps = ({
  activeFolders,
  activeTab,
  albumGroups,
  albumViewMode,
  artistGroups,
  closeMenu,
  emptyMessage,
  genreGroups,
  getSongItemLayout,
  handlePlayActiveList,
  handleShufflePress,
  importFromDevice,
  importStatus,
  isReady,
  loading,
  menuOpen,
  onAddScanFolder,
  openMenu,
  openSettings,
  playlistItems,
  query,
  refreshMetadataFromFiles,
  renderAlbumTile,
  renderFolderItem,
  renderGroupItem,
  renderPlaylistItem,
  renderSongItem,
  scanFolders,
  setActiveTab,
  setQuery,
  showScanFolders,
  songKeyExtractor,
  songsCount,
  songsForActiveList,
  toggleAlbumView,
  toggleSearch,
}: UseLibraryComponentPropsOptions): UseLibraryComponentPropsResult => {
  const topBarProps = useMemo(() => ({
    onOpenMenu: openMenu,
    onToggleSearch: toggleSearch,
  }), [openMenu, toggleSearch]);

  const tabsProps = useMemo(() => ({
    activeTab,
    onChangeTab: setActiveTab,
  }), [activeTab, setActiveTab]);

  const searchBarProps = useMemo(() => ({
    autoFocus: true,
    onChangeText: setQuery,
    value: query,
  }), [query, setQuery]);

  const importStatusProps = useMemo(() => ({
    status: importStatus,
  }), [importStatus]);

  const tabContentProps = useMemo(() => buildLibraryTabContentProps({
    activeTab,
    activeFolders,
    albumGroups,
    albumViewMode,
    artistGroups,
    emptyMessage,
    genreGroups,
    getSongItemLayout,
    onPlayActiveList: handlePlayActiveList,
    onShuffle: handleShufflePress,
    onToggleAlbumView: toggleAlbumView,
    playlistItems,
    renderAlbumTile,
    renderFolderItem,
    renderGroupItem,
    renderPlaylistItem,
    renderSongItem,
    scanFolders,
    songKeyExtractor,
    songsForActiveList,
  }), [
    activeFolders,
    activeTab,
    albumGroups,
    albumViewMode,
    artistGroups,
    emptyMessage,
    genreGroups,
    getSongItemLayout,
    handlePlayActiveList,
    handleShufflePress,
    playlistItems,
    renderAlbumTile,
    renderFolderItem,
    renderGroupItem,
    renderPlaylistItem,
    renderSongItem,
    scanFolders,
    songKeyExtractor,
    songsForActiveList,
    toggleAlbumView,
  ]);

  const menuModalProps = useMemo(() => buildLibraryMenuModalProps({
    activeFolders,
    closeMenu,
    importFromDevice,
    isReady,
    loading,
    menuOpen,
    onAddScanFolder,
    openSettings,
    refreshMetadataFromFiles,
    showScanFolders,
    songsCount,
  }), [
    activeFolders,
    closeMenu,
    importFromDevice,
    isReady,
    loading,
    menuOpen,
    onAddScanFolder,
    openSettings,
    refreshMetadataFromFiles,
    showScanFolders,
    songsCount,
  ]);

  return { importStatusProps, menuModalProps, searchBarProps, tabContentProps, tabsProps, topBarProps };
};
