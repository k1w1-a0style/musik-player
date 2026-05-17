import { useMemo } from 'react';
import type { LibraryMenuModalProps } from '../components/LibraryMenuModal';
import type { LibraryTabContentProps } from '../components/LibraryTabContent';
import type { LibraryAlbumViewMode } from '../components/LibraryAlbumViewToggle';
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
  isReady: boolean;
  loading: boolean;
  menuOpen: boolean;
  onAddScanFolder: () => void;
  openSettings: () => void;
  playlistItems: LibraryPlaylistItem[];
  refreshMetadataFromFiles: () => void;
  renderAlbumTile: LibraryTabContentProps['renderAlbumTile'];
  renderFolderItem: LibraryTabContentProps['renderFolderItem'];
  renderGroupItem: LibraryTabContentProps['renderGroupItem'];
  renderPlaylistItem: LibraryTabContentProps['renderPlaylistItem'];
  renderSongItem: LibraryTabContentProps['renderSongItem'];
  scanFolders: ScanFolder[];
  showScanFolders: () => void;
  songKeyExtractor: (item: Song) => string;
  songsCount: number;
  songsForActiveList: Song[];
  toggleAlbumView: () => void;
}

interface UseLibraryComponentPropsResult {
  menuModalProps: LibraryMenuModalProps;
  tabContentProps: LibraryTabContentProps;
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
  songsCount,
  songsForActiveList,
  toggleAlbumView,
}: UseLibraryComponentPropsOptions): UseLibraryComponentPropsResult => {
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

  return { menuModalProps, tabContentProps };
};
