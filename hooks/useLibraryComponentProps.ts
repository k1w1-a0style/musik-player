import { useMemo } from 'react';
import type { LibraryScreenContentProps } from '../components/LibraryScreenContent';
import type { LibraryAlbumViewMode } from '../components/LibraryAlbumViewToggle';
import type { Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import {
  buildLibraryImportStatusProps,
  buildLibraryMenuModalProps,
  buildLibrarySearchBarProps,
  buildLibraryTabContentProps,
  buildLibraryTabsProps,
  buildLibraryTopBarProps,
  type LibraryImportStatusPropsBuilderOptions,
  type LibraryMenuModalPropsBuilderOptions,
  type LibrarySearchBarPropsBuilderOptions,
  type LibraryTabContentPropsBuilderOptions,
  type LibraryTabsPropsBuilderOptions,
  type LibraryTopBarPropsBuilderOptions,
} from '../utils/libraryComponentProps';
import type { LibraryGroupItem } from '../utils/libraryPresentation';
import type { LibraryPlaylistItem } from '../utils/libraryPlaylists';
import type { LibraryTab } from '../utils/libraryTabs';

type UseLibraryComponentPropsResult = Omit<LibraryScreenContentProps, 'loading' | 'searchOpen'>;

type UseLibraryChromePropsOptions = LibraryTopBarPropsBuilderOptions
  & LibraryTabsPropsBuilderOptions
  & LibrarySearchBarPropsBuilderOptions
  & LibraryImportStatusPropsBuilderOptions;

type UseLibraryComponentPropsOptions = UseLibraryChromePropsOptions
  & LibraryMenuModalPropsBuilderOptions
  & Omit<LibraryTabContentPropsBuilderOptions, 'onPlayActiveList' | 'onShuffle' | 'onToggleAlbumView'>
  & {
    handlePlayActiveList: () => void;
    handleShufflePress: () => void;
    toggleAlbumView: () => void;
    albumViewMode: LibraryAlbumViewMode;
    albumGroups: LibraryGroupItem[];
    artistGroups: LibraryGroupItem[];
    genreGroups: LibraryGroupItem[];
    playlistItems: LibraryPlaylistItem[];
    scanFolders: ScanFolder[];
    songKeyExtractor: (item: Song) => string;
    songsForActiveList: Song[];
  };

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
  const topBarProps = useMemo(() => buildLibraryTopBarProps({
    openMenu,
    toggleSearch,
  }), [openMenu, toggleSearch]);

  const tabsProps = useMemo(() => buildLibraryTabsProps({
    activeTab,
    setActiveTab,
  }), [activeTab, setActiveTab]);

  const searchBarProps = useMemo(() => buildLibrarySearchBarProps({
    query,
    setQuery,
  }), [query, setQuery]);

  const importStatusProps = useMemo(() => buildLibraryImportStatusProps({
    importStatus,
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
