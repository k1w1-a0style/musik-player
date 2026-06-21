import { useLibraryControllerActions } from './useLibraryControllerActions';
import { useLibraryAudioInfoBackfill } from './useLibraryAudioInfoBackfill';
import { useLibraryCoverBackfill } from './useLibraryCoverBackfill';
import { useLibraryControllerProps } from './useLibraryControllerProps';
import { useLibraryControllerRenderers } from './useLibraryControllerRenderers';
import { useLibraryControllerState } from './useLibraryControllerState';
import { useLibraryControllerViewModel } from './useLibraryControllerViewModel';
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
    songs,
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
  });
};
