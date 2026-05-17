import React, { useCallback, useMemo, useState } from 'react';
import {
  Text,
  StyleSheet,
  FlatList,
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
import LibrarySectionHeader from '../components/LibrarySectionHeader';
import LibraryMenuModal from '../components/LibraryMenuModal';
import LibraryPlaybackActions from '../components/LibraryPlaybackActions';
import LibraryAlbumViewToggle, { type LibraryAlbumViewMode } from '../components/LibraryAlbumViewToggle';
import LibraryListShell from '../components/LibraryListShell';
import type { Song } from '../types/Song';
import { theme } from '../theme';
import type { AppStackParamList } from '../types/navigation';
import type { ScanFolder } from '../types/ScanFolder';
import { APP_STACK_ROUTES } from '../types/routes';
import { refreshSongsFromId3 } from '../utils/songMetadataRefresh';
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
import { withTimeout } from '../utils/withTimeout';
import { getLibrarySettingsComingSoonAlert } from '../utils/librarySettingsMessages';
import {
  buildMetadataRefreshAvailabilityResult,
  buildMetadataRefreshResult,
  getMetadataRefreshFlowCopy,
  getMetadataUpdateStoppedAlert,
} from '../utils/libraryImportFlow';
import { useLibraryStoredState } from '../hooks/useLibraryStoredState';
import { useLibraryScanFolderActions } from '../hooks/useLibraryScanFolderActions';
import { useLibraryImportActions } from '../hooks/useLibraryImportActions';

declare const __DEV__: boolean;

const SONG_ROW_HEIGHT = 62;
const GROUP_ROW_HEIGHT = 66;
const IMPORT_TIMEOUT_MS = 90_000;
const NODE_ENV = process.env.NODE_ENV;

type GroupItem = LibraryGroupItem;
type PlaylistItem = LibraryPlaylistItem;
type MetadataRefreshFlowCopy = ReturnType<typeof getMetadataRefreshFlowCopy>;

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

  const openSettings = useCallback(() => {
    const settingsAlert = getLibrarySettingsComingSoonAlert();
    setMenuOpen(false);
    showAlert(settingsAlert);
  }, [showAlert]);

  const runMetadataRefresh = useCallback(async (refreshCopy: MetadataRefreshFlowCopy): Promise<void> => {
    setImportStatus(refreshCopy.readingStatus);
    const result = await withTimeout(refreshSongsFromId3(songs), IMPORT_TIMEOUT_MS, refreshCopy.timeoutMessage);
    const refreshResult = buildMetadataRefreshResult(result.songs, result.updated, result.skipped, result.failed);
    if (refreshResult.shouldApplyUpdate) setSongs(refreshResult.songs);
    showAlert(refreshResult.alert);
  }, [setSongs, showAlert, songs]);

  const refreshMetadataFromFiles = async (): Promise<void> => {
    setMenuOpen(false);
    const availabilityResult = buildMetadataRefreshAvailabilityResult(songs.length);
    if (availabilityResult.kind === 'empty') {
      showAlert(availabilityResult.alert);
      return;
    }
    const refreshCopy = getMetadataRefreshFlowCopy();
    try {
      setLoading(true);
      await runMetadataRefresh(refreshCopy);
    } catch (error) {
      const stoppedAlert = getMetadataUpdateStoppedAlert(error);
      showAlert(stoppedAlert);
    } finally {
      setLoading(false);
      setImportStatus(null);
    }
  };

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

  return (
    <AppBackground>
      <Screen testID="library-screen" contentStyle={styles.container}>
        <LibraryTopBar onToggleSearch={() => setSearchOpen(value => !value)} onOpenMenu={() => setMenuOpen(true)} />

        <LibraryTabs activeTab={activeTab} onChangeTab={setActiveTab} />

        {searchOpen && <LibrarySearchBar value={query} onChangeText={setQuery} autoFocus />}
        {loading && <LibraryImportStatus status={importStatus} />}

        {activeTab === 'folders' ? (
          <LibraryListShell testID="library-folders-shell">
            <LibrarySectionHeader title="Scan-Ordner" count={`${activeFolders} aktiv`} />
            <FlatList data={scanFolders} keyExtractor={item => item.id} contentContainerStyle={styles.listContent} renderItem={renderFolderItem} ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>} />
          </LibraryListShell>
        ) : activeTab === 'albums' ? (
          <LibraryListShell testID="library-albums-shell">
            <LibrarySectionHeader title="Alben">
              <Text style={styles.folderCount}>{albumGroups.length}</Text>
              <LibraryAlbumViewToggle mode={albumViewMode} onToggle={() => setAlbumViewMode(mode => mode === 'grid' ? 'list' : 'grid')} />
            </LibrarySectionHeader>
            {albumViewMode === 'grid' ? <FlatList data={albumGroups} keyExtractor={item => item.id} contentContainerStyle={styles.albumGridContent} renderItem={renderAlbumTile} numColumns={2} columnWrapperStyle={styles.albumColumn} ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>} /> : <FlatList data={albumGroups} keyExtractor={item => item.id} contentContainerStyle={styles.listContent} renderItem={renderGroupItem} getItemLayout={(_, index) => ({ length: GROUP_ROW_HEIGHT, offset: GROUP_ROW_HEIGHT * index, index })} ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>} />}
          </LibraryListShell>
        ) : activeTab === 'artists' || activeTab === 'genres' ? (
          <LibraryListShell testID={`library-${activeTab}-shell`}>
            <LibrarySectionHeader title={activeTab === 'artists' ? 'Interpreten' : 'Genres'} count={activeTab === 'artists' ? artistGroups.length : genreGroups.length} />
            <FlatList data={activeTab === 'artists' ? artistGroups : genreGroups} keyExtractor={item => item.id} contentContainerStyle={styles.listContent} renderItem={renderGroupItem} getItemLayout={(_, index) => ({ length: GROUP_ROW_HEIGHT, offset: GROUP_ROW_HEIGHT * index, index })} ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>} />
          </LibraryListShell>
        ) : activeTab === 'playlists' ? (
          <LibraryListShell testID="library-playlists-shell">
            <LibrarySectionHeader title="Playlisten" count={playlistItems.length} />
            <FlatList data={playlistItems} keyExtractor={item => item.id} contentContainerStyle={styles.listContent} renderItem={renderPlaylistItem} getItemLayout={(_, index) => ({ length: GROUP_ROW_HEIGHT, offset: GROUP_ROW_HEIGHT * index, index })} ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>} />
          </LibraryListShell>
        ) : (
          <LibraryListShell testID={`library-${activeTab}-shell`}>
            <LibrarySectionHeader title={activeTab === 'favorites' ? 'Favoriten' : 'Name'}>
              <LibraryPlaybackActions
                disabled={songsForActiveList.length === 0}
                showFavoriteIcon={activeTab === 'favorites'}
                onShuffle={handleShufflePress}
                onPlay={() => {
                  if (songsForActiveList[0]) handleSongPress(songsForActiveList[0], songsForActiveList);
                }}
              />
            </LibrarySectionHeader>
            <FlatList data={songsForActiveList} keyExtractor={keyExtractor} contentContainerStyle={styles.listContent} renderItem={renderItem} removeClippedSubviews windowSize={7} initialNumToRender={10} maxToRenderPerBatch={8} updateCellsBatchingPeriod={80} getItemLayout={getItemLayout} ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>} />
          </LibraryListShell>
        )}

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
  folderCount: { color: theme.palette.text.muted, fontFamily: theme.fonts.body, fontSize: 12 },
  listContent: { paddingBottom: 96 },
  albumGridContent: { paddingBottom: 104 },
  albumColumn: { gap: 12 },
  empty: { color: theme.palette.text.muted, textAlign: 'center', marginTop: 30, fontFamily: theme.fonts.body },
});

export default Library;
