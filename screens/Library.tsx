import React, { useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
import type { Song } from '../types/Song';
import type { AppStackParamList } from '../types/navigation';
import { APP_STACK_ROUTES } from '../types/routes';
import { getLibrarySettingsComingSoonAlert } from '../utils/librarySettingsMessages';
import { buildLibraryViewState } from '../utils/libraryViewState';
import {
  useLibraryImportActions,
  useLibraryMetadataRefreshActions,
  useLibraryRenderers,
  useLibraryScanFolderActions,
  useLibraryStoredState,
} from '../hooks/libraryHooks';
import { shuffleItems } from '../utils/libraryShuffle';
import { type LibraryTab } from '../utils/libraryTabs';

declare const __DEV__: boolean;

const NODE_ENV = process.env.NODE_ENV;

interface LibraryAlertCopy {
  title: string;
  message: string;
}

const Library: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { songs, setSongs, currentSong, playSong, isReady, isPlaying, playlists = [], playPlaylist = async () => undefined } = useLibraryMusicContext();
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<LibraryTab>('tracks');
  const [albumViewMode, setAlbumViewMode] = useState<LibraryAlbumViewMode>('grid');
  const { scanFolders, setScanFolders, favoriteIds } = useLibraryStoredState(activeTab);

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
  } = useMemo(() => buildLibraryViewState({
    activeTab,
    favoriteIds,
    isDev: __DEV__,
    isReady,
    nodeEnv: NODE_ENV,
    playlists,
    query,
    scanFolders,
    songs,
  }), [activeTab, favoriteIds, isReady, playlists, query, scanFolders, songs]);

  const showAlert = useCallback((alert: LibraryAlertCopy) => {
    Alert.alert(alert.title, alert.message);
  }, []);

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

  const handleOpenTrackInfo = useCallback((song: Song) => {
    navigation.navigate(APP_STACK_ROUTES.TRACK_INFO, { songId: song.id });
  }, [navigation]);

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
    onOpenTrackInfo: handleOpenTrackInfo,
    playPlaylist,
    playSong,
    removeFolder,
  });

  const openSettings = useCallback(() => {
    const settingsAlert = getLibrarySettingsComingSoonAlert();
    setMenuOpen(false);
    showAlert(settingsAlert);
  }, [showAlert]);

  const handleShufflePress = useCallback(() => {
    if (songsForActiveList.length === 0) return;
    const shuffled = shuffleItems(songsForActiveList);
    void playSong(shuffled[0], shuffled);
  }, [playSong, songsForActiveList]);
  const handlePlayActiveList = useCallback(() => {
    if (songsForActiveList[0]) handleSongPress(songsForActiveList[0], songsForActiveList);
  }, [handleSongPress, songsForActiveList]);
  const toggleAlbumView = useCallback(() => {
    setAlbumViewMode(mode => mode === 'grid' ? 'list' : 'grid');
  }, []);

  return (
    <AppBackground>
      <Screen testID="library-screen" contentStyle={styles.container}>
        <LibraryTopBar onToggleSearch={() => setSearchOpen(value => !value)} onOpenMenu={() => setMenuOpen(true)} />

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
          onClose={() => setMenuOpen(false)}
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
