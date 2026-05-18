import type { LibraryScreenContentProps } from '../components/LibraryScreenContent';
import { useLibraryMusicContext } from '../contexts/MusicContext';
import { useLibraryAlerts } from './useLibraryAlerts';
import { useLibraryComponentProps } from './useLibraryComponentProps';
import { useLibraryImportActions } from './useLibraryImportActions';
import { useLibraryMenuActions } from './useLibraryMenuActions';
import { useLibraryMetadataRefreshActions } from './useLibraryMetadataRefreshActions';
import { useLibraryNavigationActions } from './useLibraryNavigationActions';
import { useLibraryPlaybackActions } from './useLibraryPlaybackActions';
import { useLibraryRenderers } from './useLibraryRenderers';
import { useLibraryScanFolderActions } from './useLibraryScanFolderActions';
import { useLibraryScreenState } from './useLibraryScreenState';
import { useLibraryStoredState } from './useLibraryStoredState';
import { useLibraryViewState } from './useLibraryViewState';

export type UseLibraryControllerResult = LibraryScreenContentProps;

export const useLibraryController = (): UseLibraryControllerResult => {
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

  return useLibraryComponentProps({
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
    songsCount: songs.length,
    songsForActiveList,
    toggleSearch,
  });
};
