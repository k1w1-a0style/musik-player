import { useLibraryMusicContext } from '../contexts/MusicContext';
import {
  useLibraryAlerts,
  useLibraryComponentProps,
  useLibraryImportActions,
  useLibraryMenuActions,
  useLibraryMetadataRefreshActions,
  useLibraryNavigationActions,
  useLibraryPlaybackActions,
  useLibraryRenderers,
  useLibraryScanFolderActions,
  useLibraryScreenState,
  useLibraryStoredState,
  useLibraryViewState,
} from './libraryHooks';

export const useLibraryController = () => {
  const { songs, setSongs, currentSong, playSong, isReady, isPlaying, playlists = [], playPlaylist = async () => undefined } = useLibraryMusicContext();
  const {
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
  } = useLibraryScreenState();
  const { scanFolders, setScanFolders, favoriteIds } = useLibraryStoredState(activeTab);
  const { openTrackInfo } = useLibraryNavigationActions();
  const { showAlert } = useLibraryAlerts();

  const currentSongId = currentSong?.id ?? null;
  const {
    activeFolders,
    albumGroups,
    artistGroups,
    emptyMessage,
    filteredSongs,
    genreGroups,
    playlistItems,
    songsForActiveList,
  } = useLibraryViewState({
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
    openMenu,
    openSettings,
    toggleSearch,
  } = useLibraryMenuActions({
    setMenuOpen,
    setSearchOpen,
    showAlert,
  });

  const {
    showScanFolders,
    onAddScanFolder,
    persistChangedFolderUpdates,
    removeFolder,
  } = useLibraryScanFolderActions({
    scanFolders,
    setScanFolders,
    setActiveTab,
    setMenuOpen,
    showAlert,
  });

  const { importFromDevice } = useLibraryImportActions({
    scanFolders,
    songs,
    setSongs,
    setActiveTab,
    setMenuOpen,
    setLoading,
    setImportStatus,
    showAlert,
    persistChangedFolderUpdates,
  });

  const { refreshMetadataFromFiles } = useLibraryMetadataRefreshActions({
    songs,
    setSongs,
    setMenuOpen,
    setLoading,
    setImportStatus,
    showAlert,
  });

  const {
    getSongItemLayout,
    handleSongPress,
    renderAlbumTile,
    renderFolderItem,
    renderGroupItem,
    renderPlaylistItem,
    renderSongItem,
    songKeyExtractor,
  } = useLibraryRenderers({
    currentSongId,
    filteredSongs,
    isPlaying,
    onOpenTrackInfo: openTrackInfo,
    playPlaylist,
    playSong,
    removeFolder,
  });

  const {
    handlePlayActiveList,
    handleShufflePress,
    toggleAlbumView,
  } = useLibraryPlaybackActions({
    handleSongPress,
    playSong,
    setAlbumViewMode,
    songsForActiveList,
  });

  const { menuModalProps, tabContentProps } = useLibraryComponentProps({
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
    isReady,
    loading,
    menuOpen,
    onAddScanFolder,
    openSettings,
    playlistItems,
    refreshMetadataFromFiles,
    renderAlbumTile,
    renderFolderItem,
    renderGroupItem,
    renderPlaylistItem,
    renderSongItem,
    scanFolders,
    showScanFolders,
    songKeyExtractor,
    songsCount: songs.length,
    songsForActiveList,
    toggleAlbumView,
  });

  return {
    activeTab,
    importStatus,
    loading,
    menuModalProps,
    query,
    searchOpen,
    setActiveTab,
    setQuery,
    tabContentProps,
    topBarProps: {
      onOpenMenu: openMenu,
      onToggleSearch: toggleSearch,
    },
  };
};
