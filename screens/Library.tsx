import React, { useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useLibraryMusicContext } from '../contexts/MusicContext';
import SongCard from '../components/SongCard';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import LibraryFolderRow from '../components/LibraryFolderRow';
import LibraryPlaylistRow from '../components/LibraryPlaylistRow';
import LibraryGroupRow from '../components/LibraryGroupRow';
import LibraryAlbumTile from '../components/LibraryAlbumTile';
import LibrarySearchBar from '../components/LibrarySearchBar';
import LibraryTopBar from '../components/LibraryTopBar';
import LibraryTabs from '../components/LibraryTabs';
import LibraryImportStatus from '../components/LibraryImportStatus';
import LibraryMenuModal from '../components/LibraryMenuModal';
import LibraryTabContent from '../components/LibraryTabContent';
import type { LibraryAlbumViewMode } from '../components/LibraryAlbumViewToggle';
import type { Song } from '../types/Song';
import type { AppStackParamList } from '../types/navigation';
import type { ScanFolder } from '../types/ScanFolder';
import { APP_STACK_ROUTES } from '../types/routes';
import {
  displayAlbum,
  displayArtist,
  groupSongs,
  type LibraryGroupItem,
} from '../utils/libraryPresentation';
import { buildLibraryPlaylistItems, type LibraryPlaylistItem } from '../utils/libraryPlaylists';
import { shuffleItems } from '../utils/libraryShuffle';
import { countActiveScanFolders, getLibraryEmptyMessage, type LibraryTab } from '../utils/libraryTabs';
import { filterFavoriteSongs, filterLibrarySongs } from '../utils/librarySongs';
import { getLibraryDisplaySongs, isDemoSong } from '../utils/libraryDemoSongs';
import { getLibrarySettingsComingSoonAlert } from '../utils/librarySettingsMessages';
import {
  useLibraryImportActions,
  useLibraryMetadataRefreshActions,
  useLibraryScanFolderActions,
  useLibraryStoredState,
} from '../hooks/libraryHooks';

declare const __DEV__: boolean;

const SONG_ROW_HEIGHT = 62;
const NODE_ENV = process.env.NODE_ENV;

type GroupItem = LibraryGroupItem;
type PlaylistItem = LibraryPlaylistItem;

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
  const displayedSongs = useMemo(() => getLibraryDisplaySongs(songs, isReady, __DEV__, NODE_ENV), [isReady, songs]);
  const filteredSongs = useMemo(() => filterLibrarySongs(displayedSongs, query), [displayedSongs, query]);
  const favoriteSongs = useMemo(() => filterFavoriteSongs(filteredSongs, favoriteIds), [favoriteIds, filteredSongs]);
  const albumGroups = useMemo(() => groupSongs(filteredSongs, 'album'), [filteredSongs]);
  const artistGroups = useMemo(() => groupSongs(filteredSongs, 'artist'), [filteredSongs]);
  const genreGroups = useMemo(() => groupSongs(filteredSongs, 'genre'), [filteredSongs]);
  const playlistItems = useMemo<PlaylistItem[]>(
    () => buildLibraryPlaylistItems(playlists, displayedSongs, query),
    [displayedSongs, playlists, query],
  );

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

  const openSettings = useCallback(() => {
    const settingsAlert = getLibrarySettingsComingSoonAlert();
    setMenuOpen(false);
    showAlert(settingsAlert);
  }, [showAlert]);

  const handleSongPress = useCallback((song: Song, queue: Song[] = filteredSongs) => void playSong(song, queue), [filteredSongs, playSong]);
  const handleInfoSong = useCallback((song: Song) => navigation.navigate(APP_STACK_ROUTES.TRACK_INFO, { songId: song.id }), [navigation]);
  const keyExtractor = useCallback((item: Song) => item.id, []);
  const getItemLayout = useCallback((_: ArrayLike<Song> | null | undefined, index: number) => ({ length: SONG_ROW_HEIGHT, offset: SONG_ROW_HEIGHT * index, index }), []);

  const renderItem = useCallback(({ item }: { item: Song }) => (
    <SongCard song={{ ...item, artist: displayArtist(item), album: displayAlbum(item) }} isCurrent={currentSongId === item.id} isPlaying={currentSongId === item.id && isPlaying} onPressSong={song => handleSongPress(song, filteredSongs)} onInfoSong={isDemoSong(item) ? undefined : handleInfoSong} />
  ), [currentSongId, filteredSongs, handleInfoSong, handleSongPress, isPlaying]);

  const renderGroupItem = useCallback(({ item }: { item: GroupItem }) => (
    <LibraryGroupRow group={item} onPress={group => group.songs[0] && handleSongPress(group.songs[0], group.songs)} />
  ), [handleSongPress]);

  const renderAlbumTile = useCallback(({ item }: { item: GroupItem }) => (
    <LibraryAlbumTile album={item} onPress={album => album.songs[0] && handleSongPress(album.songs[0], album.songs)} />
  ), [handleSongPress]);

  const renderPlaylistItem = useCallback(({ item }: { item: PlaylistItem }) => (
    <LibraryPlaylistRow playlist={item} onPlay={playlistId => void playPlaylist(playlistId)} />
  ), [playPlaylist]);

  const renderFolderItem = useCallback(({ item }: { item: ScanFolder }) => (
    <LibraryFolderRow folder={item} onRemove={removeFolder} />
  ), [removeFolder]);

  const activeFolders = countActiveScanFolders(scanFolders);
  const emptyMessage = getLibraryEmptyMessage(activeTab);

  const songsForActiveList = activeTab === 'favorites' ? favoriteSongs : filteredSongs;
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
          getSongItemLayout={getItemLayout}
          onPlayActiveList={handlePlayActiveList}
          onShuffle={handleShufflePress}
          onToggleAlbumView={toggleAlbumView}
          playlistItems={playlistItems}
          renderAlbumTile={renderAlbumTile}
          renderFolderItem={renderFolderItem}
          renderGroupItem={renderGroupItem}
          renderPlaylistItem={renderPlaylistItem}
          renderSongItem={renderItem}
          scanFolders={scanFolders}
          songKeyExtractor={keyExtractor}
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
