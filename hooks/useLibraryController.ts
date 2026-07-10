import { useCallback, useMemo, useState } from 'react';
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
import type { Song } from '../types/Song';
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
      playSongNext,
      addSongToQueue,
      playlists,
      addSongToPlaylist,
      removeSongFromPlaylist,
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
    openPlaylistDetail,
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

  const [songActionSong, setSongActionSong] = useState<Song | null>(null);
  const [playlistPickerSong, setPlaylistPickerSong] = useState<Song | null>(null);

  const closeSongActionMenu = useCallback(() => setSongActionSong(null), []);
  const closePlaylistPicker = useCallback(() => setPlaylistPickerSong(null), []);
  const openSongActionMenu = useCallback((song: Song) => setSongActionSong(song), []);
  const openTrackInfoFromSongMenu = useCallback(() => {
    if (!songActionSong) return;
    closeSongActionMenu();
    openTrackInfo(songActionSong);
  }, [closeSongActionMenu, openTrackInfo, songActionSong]);
  const openPlaylistPickerFromSongMenu = useCallback(() => {
    if (!songActionSong) return;
    setPlaylistPickerSong(songActionSong);
    closeSongActionMenu();
  }, [closeSongActionMenu, songActionSong]);
  const playSongNextFromSongMenu = useCallback(() => {
    if (!songActionSong) return;
    void playSongNext(songActionSong);
    closeSongActionMenu();
  }, [closeSongActionMenu, playSongNext, songActionSong]);
  const addSongToQueueFromSongMenu = useCallback(() => {
    if (!songActionSong) return;
    void addSongToQueue(songActionSong);
    closeSongActionMenu();
  }, [addSongToQueue, closeSongActionMenu, songActionSong]);
  const toggleSongPlaylist = useCallback((playlistId: string, containsSong: boolean) => {
    if (!playlistPickerSong) return;
    if (containsSong) {
      removeSongFromPlaylist(playlistId, playlistPickerSong.id);
    } else {
      addSongToPlaylist(playlistId, playlistPickerSong.id);
    }
  }, [addSongToPlaylist, playlistPickerSong, removeSongFromPlaylist]);


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
    onOpenPlaylistDetail: openPlaylistDetail,
    onOpenTrackInfo: openTrackInfo,
    onOpenSongActions: openSongActionMenu,
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
    songActionMenuProps: {
      visible: !!songActionSong,
      onClose: closeSongActionMenu,
      onOpenTrackInfo: openTrackInfoFromSongMenu,
      onPlayNext: playSongNextFromSongMenu,
      onAddToQueue: addSongToQueueFromSongMenu,
      onOpenPlaylistPicker: openPlaylistPickerFromSongMenu,
    },
    songPlaylistPickerProps: {
      visible: !!playlistPickerSong,
      song: playlistPickerSong,
      playlists,
      onClose: closePlaylistPicker,
      onTogglePlaylist: toggleSongPlaylist,
    },
  });
};
