import { useMemo } from 'react';
import type { LibraryScreenContentProps } from '../components/LibraryScreenContent';
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

interface UseLibraryScreenVisibilityOptions {
  searchOpen: boolean;
}

type UseLibraryComponentPropsOptions = LibraryTopBarPropsBuilderOptions
  & LibraryTabsPropsBuilderOptions
  & LibrarySearchBarPropsBuilderOptions
  & LibraryImportStatusPropsBuilderOptions
  & LibraryMenuModalPropsBuilderOptions
  & LibraryTabContentPropsBuilderOptions
  & UseLibraryScreenVisibilityOptions;

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
  importFromDevice,
  importStatus,
  isReady,
  loading,
  menuOpen,
  onAddScanFolder,
  onPlayActiveList,
  onShuffle,
  onToggleAlbumView,
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
  searchOpen,
  setActiveTab,
  setQuery,
  showScanFolders,
  songKeyExtractor,
  songsCount,
  songsForActiveList,
  toggleSearch,
}: UseLibraryComponentPropsOptions): LibraryScreenContentProps => {
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
    onPlayActiveList,
    onShuffle,
    onToggleAlbumView,
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
    onPlayActiveList,
    onShuffle,
    onToggleAlbumView,
    playlistItems,
    renderAlbumTile,
    renderFolderItem,
    renderGroupItem,
    renderPlaylistItem,
    renderSongItem,
    scanFolders,
    songKeyExtractor,
    songsForActiveList,
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

  return { importStatusProps, loading, menuModalProps, searchBarProps, searchOpen, tabContentProps, tabsProps, topBarProps };
};
