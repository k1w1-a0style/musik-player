import { useMemo } from 'react';
import type { LibraryScreenContentProps } from '../components/LibraryScreenContent';
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
} from '../utils/libraryComponentProps';

export type UseLibraryComponentPropsOptions = LibraryTopBarPropsBuilderOptions
  & LibraryTabsPropsBuilderOptions
  & LibrarySearchBarPropsBuilderOptions
  & LibraryImportStatusPropsBuilderOptions
  & LibraryMenuModalPropsBuilderOptions
  & LibraryTabContentPropsBuilderOptions
  & LibraryScreenVisibilityPropsBuilderOptions;

export type UseLibraryComponentPropsResult = LibraryScreenContentProps;

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
  openEqualizer,
  playlistItems,
  query,
  refreshMetadataFromFiles,
  cancelMetadataRefresh,
  resumeMetadataRefresh,
  refreshHasResumable,
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
  sortMode,
  onCycleSortMode,
  songViewMode,
  onCycleSongViewMode,
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
    cancelMetadataRefresh,
    resumeMetadataRefresh,
  }), [importStatus, cancelMetadataRefresh, resumeMetadataRefresh]);

  const visibilityProps = useMemo(() => buildLibraryScreenVisibilityProps({
    loading,
    searchOpen,
    refreshHasResumable,
  }), [loading, searchOpen, refreshHasResumable]);

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
    sortMode,
    onCycleSortMode,
    songViewMode,
    onCycleSongViewMode,
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
    sortMode,
    onCycleSortMode,
    songViewMode,
    onCycleSongViewMode,
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
    openEqualizer,
    refreshMetadataFromFiles,
    showScanFolders,
    songsCount,
    canResumeRefresh: refreshHasResumable,
  }), [
    activeFolders,
    closeMenu,
    importFromDevice,
    isReady,
    loading,
    menuOpen,
    onAddScanFolder,
    openSettings,
    openEqualizer,
    refreshMetadataFromFiles,
    showScanFolders,
    songsCount,
    refreshHasResumable,
  ]);

  return { importStatusProps, menuModalProps, searchBarProps, tabContentProps, tabsProps, topBarProps, ...visibilityProps };
};
