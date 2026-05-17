import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useLibraryMusicContext } from '../contexts/MusicContext';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import LibrarySearchBar from '../components/LibrarySearchBar';
import LibraryTopBar from '../components/LibraryTopBar';
import LibraryTabs from '../components/LibraryTabs';
import LibraryImportStatus from '../components/LibraryImportStatus';
import LibraryMenuModal from '../components/LibraryMenuModal';
import LibraryTabContent from '../components/LibraryTabContent';
import type { LibraryAlbumViewMode } from '../components/LibraryAlbumViewToggle';
import {
  useLibraryAlerts,
  useLibraryImportActions,
  useLibraryMenuActions,
  useLibraryMetadataRefreshActions,
  useLibraryNavigationActions,
  useLibraryPlaybackActions,
  useLibraryRenderers,
  useLibraryScanFolderActions,
  useLibraryStoredState,
  useLibraryViewState,
} from '../hooks/libraryHooks';
import { type LibraryTab } from '../utils/libraryTabs';

const Library: React.FC = () => {
  const { songs, setSongs, currentSong, playSong, isReady, isPlaying, playlists = [], playPlaylist = async () => undefined } = useLibraryMusicContext();
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<LibraryTab>('tracks');
  const [albumViewMode, setAlbumViewMode] = useState<LibraryAlbumViewMode>('grid');
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

  return (
    <AppBackground>
      <Screen testID="library-screen" contentStyle={styles.container}>
        <LibraryTopBar onToggleSearch={toggleSearch} onOpenMenu={openMenu} />

        <LibraryTabs activeTab={activeTab} onChangeTab={setActiveTab} />

        {searchOpen && <LibrarySearchBar value={query} onChangeText={setQuery} autoFocus />}
        {loading && <LibraryImportStatus status={importStatus} />}

        <LibraryTabContent
          activeTab={activeTab}
          activeFolders={activeFolders}
          albumGroups={albumGroups}
          albumViewMode={albumViewMode}
          artistGroups={artistGroups}
          emptyMessage={emptyMessage}
          genreGroups={genreGroups}
          getSongItemLayout={getSongItemLayout}
          onPlayActiveList={handlePlayActiveList}
          onShuffle={handleShufflePress}
          onToggleAlbumView={toggleAlbumView}
          playlistItems={playlistItems}
          renderAlbumTile={renderAlbumTile}
          renderFolderItem={renderFolderItem}
          renderGroupItem={renderGroupItem}
          renderPlaylistItem={renderPlaylistItem}
          renderSongItem={renderSongItem}
          scanFolders={scanFolders}
          songKeyExtractor={songKeyExtractor}
          songsForActiveList={songsForActiveList}
        />

        <LibraryMenuModal
          visible={menuOpen}
          loading={loading}
          isReady={isReady}
          hasSongs={songs.length > 0}
          activeFolders={activeFolders}
          onClose={closeMenu}
          onImport={importFromDevice}
          onRefreshMetadata={refreshMetadataFromFiles}
          onAddFolder={onAddScanFolder}
          onShowFolders={showScanFolders}
          onOpenSettings={openSettings}
        />
      </Screen>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 0, paddingTop: 8 },
});

export default Library;
