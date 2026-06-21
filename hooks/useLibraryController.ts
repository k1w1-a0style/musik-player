import { useMemo } from 'react';
import { useLibraryControllerActions } from './useLibraryControllerActions';
import { useLibraryAudioInfoBackfill } from './useLibraryAudioInfoBackfill';
import { useLibraryCoverBackfill } from './useLibraryCoverBackfill';
import { useLibraryControllerProps } from './useLibraryControllerProps';
import { useLibraryControllerRenderers } from './useLibraryControllerRenderers';
import { useLibraryControllerState } from './useLibraryControllerState';
import { useLibraryControllerViewModel } from './useLibraryControllerViewModel';
import { useLibrarySortMode } from './useLibrarySortMode';
import { useLibrarySongViewMode } from './useLibrarySongViewMode';
import { sortLibrarySongs } from '../utils/librarySort';
import {
  canResumeMetadataRefresh,
  useMetadataRefreshOperation,
} from '../utils/metadataRefreshOperation';
import type { UseLibraryComponentPropsResult } from './useLibraryComponentProps';

export type UseLibraryControllerResult = UseLibraryComponentPropsResult;

export const useLibraryController = (): UseLibraryControllerResult => {
  const {
    music: {
      currentSongId,
      isPlaying,
      isReady,
      playPlaylist,
      playSong,
      playlists,
      setSongs,
      songs,
      songsCount,
      applySongMetadataPatches,
    },
    screen: {
      activeTab,
      albumViewMode,
      importStatus,
      loading,
      menuOpen,
      query,
      searchOpen,
      setActiveTab,
      setAlbumViewMode,
      setImportStatus,
      setLoading,
      setMenuOpen,
      setQuery,
      setSearchOpen,
    },
    stored: {
      favoriteIds,
      scanFolders,
      setScanFolders,
    },
  } = useLibraryControllerState();

  const { sortMode, cycleSortMode } = useLibrarySortMode();
  const { viewMode, cycleViewMode } = useLibrarySongViewMode();
  const sortedSongs = useMemo(() => sortLibrarySongs(songs, sortMode), [songs, sortMode]);

  const {
    activeFolders,
    albumGroups,
    artistGroups,
    emptyMessage,
    filteredSongs,
    genreGroups,
    playlistItems,
    songsForActiveList,
  } = useLibraryControllerViewModel({
    activeTab,
    favoriteIds,
    isReady,
    playlists,
    query,
    scanFolders,
    songs: sortedSongs,
  });

  const {
    closeMenu,
    importFromDevice,
    onAddScanFolder,
    openMenu,
    openSettings,
    openEqualizer,
    openTrackInfo,
    refreshMetadataFromFiles,
    cancelMetadataRefresh,
    resumeMetadataRefresh,
    removeFolder,
    showScanFolders,
    toggleSearch,
  } = useLibraryControllerActions({
    scanFolders,
    setActiveTab,
    setImportStatus,
    setLoading,
    setMenuOpen,
    setScanFolders,
    setSearchOpen,
    setSongs,
    applySongMetadataPatches,
    songs,
  });

  useLibraryCoverBackfill({ songs, applySongMetadataPatches });
  useLibraryAudioInfoBackfill({ songs, applySongMetadataPatches });

  const refreshOperation = useMetadataRefreshOperation();
  const refreshHasResumable = canResumeMetadataRefresh(refreshOperation);

  const {
    getSongItemLayout,
    handlePlayActiveList,
    handleShufflePress,
    renderAlbumTile,
    renderFolderItem,
    renderGroupItem,
    renderPlaylistItem,
    renderSongItem,
    songKeyExtractor,
    toggleAlbumView,
  } = useLibraryControllerRenderers({
    currentSongId,
    filteredSongs,
    isPlaying,
    onOpenTrackInfo: openTrackInfo,
    playPlaylist,
    playSong,
    removeFolder,
    setAlbumViewMode,
    songsForActiveList,
    songViewMode: viewMode,
  });

  return useLibraryControllerProps({
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
    onPlayActiveList: handlePlayActiveList,
    onShuffle: handleShufflePress,
    onToggleAlbumView: toggleAlbumView,
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
    onCycleSortMode: cycleSortMode,
    songViewMode: viewMode,
    onCycleSongViewMode: cycleViewMode,
    toggleSearch,
  });
};
