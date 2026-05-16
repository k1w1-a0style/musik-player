import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Text,
  StyleSheet,
  FlatList,
  Alert,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { StorageAccessFramework } from 'expo-file-system/legacy';
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
import { importSongsFromSources, scanMediaLibraryCandidates, enrichMediaLibraryAssets } from '../utils/mediaLibraryImport';
import type { AppStackParamList } from '../types/navigation';
import type { ScanFolder } from '../types/ScanFolder';
import { addScanFolder, getFavoriteSongIds, getScanFolders, removeScanFolder, updateScanFolder } from '../utils/storage';
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
import { buildScanFolderFromDirectoryUri, getEnabledScanFolders } from '../utils/libraryScanFolders';
import { confirmLibraryImport } from '../utils/libraryImportConfirmation';
import { getLibraryDisplaySongs, isDemoSong } from '../utils/libraryDemoSongs';
import { getChangedFolderUpdates } from '../utils/libraryFolderUpdates';
import { withTimeout } from '../utils/withTimeout';
import { libraryFolderMessages } from '../utils/libraryFolderMessages';
import { librarySettingsMessages } from '../utils/librarySettingsMessages';
import {
  buildImportedSongsUpdate,
  getEmptyMediaLibraryImportAlert,
  getEmptyScanImportAlert,
  getMediaLibraryPermissionDeniedAlert,
  getNoSongsMetadataAlert,
  hasImportErrors,
  hasMediaLibraryCandidates,
  hasMediaLibraryPermission,
  hasSongsForMetadataRefresh,
  shouldApplyMetadataRefresh,
  shouldImportFromScanFolders,
} from '../utils/libraryImportFlow';
import {
  libraryImportMessages,
  mediaCandidatesFoundStatus,
  metadataRefreshSummary,
  scanFoldersReadingStatus,
  tracksFoundStatus,
  tracksSavingStatus,
} from '../utils/libraryImportMessages';

declare const __DEV__: boolean;

const SONG_ROW_HEIGHT = 62;
const GROUP_ROW_HEIGHT = 66;
const IMPORT_TIMEOUT_MS = 90_000;
const NODE_ENV = process.env.NODE_ENV;

type GroupItem = LibraryGroupItem;
type PlaylistItem = LibraryPlaylistItem;

const Library: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { songs, setSongs, currentSong, playSong, isReady, isPlaying, playlists = [], playPlaylist = async () => undefined } = useLibraryMusicContext();
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [scanFolders, setScanFolders] = useState<ScanFolder[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<LibraryTab>('tracks');
  const [albumViewMode, setAlbumViewMode] = useState<LibraryAlbumViewMode>('grid');

  useEffect(() => {
    getScanFolders().then(setScanFolders).catch(() => setScanFolders([]));
    getFavoriteSongIds().then(setFavoriteIds).catch(() => setFavoriteIds([]));
  }, []);

  useEffect(() => {
    if (activeTab === 'favorites') getFavoriteSongIds().then(setFavoriteIds).catch(() => setFavoriteIds([]));
  }, [activeTab]);

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

  const onAddScanFolder = async (): Promise<void> => {
    setMenuOpen(false);
    if (Platform.OS !== 'android') {
      Alert.alert(libraryFolderMessages.unsupportedTitle, libraryFolderMessages.folderPickerUnsupportedMessage);
      return;
    }
    try {
      const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permission.granted || !permission.directoryUri) {
        Alert.alert(libraryFolderMessages.cancelledTitle, libraryFolderMessages.noFolderSelectedMessage);
        return;
      }
      const folder = buildScanFolderFromDirectoryUri(permission.directoryUri);
      const next = await addScanFolder(folder);
      if (next.length === scanFolders.length) {
        Alert.alert(libraryFolderMessages.duplicateTitle, libraryFolderMessages.duplicateFolderMessage);
        return;
      }
      setScanFolders(next);
      setActiveTab('folders');
    } catch {
      Alert.alert(libraryFolderMessages.unsupportedTitle, libraryFolderMessages.folderPickerUnavailableMessage);
    }
  };

  const importFromDevice = async (): Promise<void> => {
    setMenuOpen(false);
    setImportStatus(libraryImportMessages.preparingImport);
    try {
      setLoading(true);
      const activeFolders = getEnabledScanFolders(scanFolders);
      if (shouldImportFromScanFolders(activeFolders, Platform.OS)) {
        setImportStatus(scanFoldersReadingStatus(activeFolders.length));
        const result = await withTimeout(importSongsFromSources({ scanFolders: activeFolders, platformOs: Platform.OS }), IMPORT_TIMEOUT_MS, libraryImportMessages.scanFoldersTimeout);
        setImportStatus(tracksFoundStatus(result.songs.length));
        const changedFolderUpdates = getChangedFolderUpdates(scanFolders, result.folderUpdates);
        if (changedFolderUpdates.length > 0) {
          for (const folder of changedFolderUpdates) await updateScanFolder(folder.id, { lastError: folder.lastError });
          setScanFolders(await getScanFolders());
        }
        if (result.songs.length === 0) {
          const emptyAlert = getEmptyScanImportAlert(result.errors);
          Alert.alert(emptyAlert.title, emptyAlert.message);
          return;
        }
        if (hasImportErrors(result.errors)) Alert.alert(libraryImportMessages.partiallyImportedTitle, libraryImportMessages.partiallyImportedMessage);
        const update = buildImportedSongsUpdate(songs, result.songs);
        setSongs(update.songs);
        setActiveTab(update.activeTab);
        return;
      }

      setImportStatus(libraryImportMessages.scanningMediaLibrary);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (!hasMediaLibraryPermission(status)) {
        const permissionAlert = getMediaLibraryPermissionDeniedAlert();
        Alert.alert(permissionAlert.title, permissionAlert.message);
        return;
      }
      const candidates = await withTimeout(scanMediaLibraryCandidates(), IMPORT_TIMEOUT_MS, libraryImportMessages.mediaLibraryScanTimeout);
      setImportStatus(mediaCandidatesFoundStatus(candidates.assets.length));
      if (!hasMediaLibraryCandidates(candidates.assets.length)) {
        const emptyAlert = getEmptyMediaLibraryImportAlert();
        Alert.alert(emptyAlert.title, emptyAlert.message);
        return;
      }
      const shouldImport = await confirmLibraryImport(candidates.assets.length, candidates.skipped.length);
      if (!shouldImport) return;
      setImportStatus(libraryImportMessages.importingMetadataAndCovers);
      const mediaResult = await withTimeout(enrichMediaLibraryAssets(candidates.assets, candidates.skipped.length), IMPORT_TIMEOUT_MS, libraryImportMessages.metadataImportTimeout);
      setImportStatus(tracksSavingStatus(mediaResult.songs.length));
      const update = buildImportedSongsUpdate(songs, mediaResult.songs);
      setSongs(update.songs);
      setActiveTab(update.activeTab);
    } catch (error) {
      Alert.alert(libraryImportMessages.importStoppedTitle, error instanceof Error ? error.message : libraryImportMessages.importFallbackError);
    } finally {
      setLoading(false);
      setImportStatus(null);
    }
  };

  const refreshMetadataFromFiles = async (): Promise<void> => {
    setMenuOpen(false);
    if (!hasSongsForMetadataRefresh(songs.length)) {
      const noSongsAlert = getNoSongsMetadataAlert();
      Alert.alert(noSongsAlert.title, noSongsAlert.message);
      return;
    }
    setImportStatus(libraryImportMessages.readingId3Metadata);
    try {
      setLoading(true);
      const result = await withTimeout(refreshSongsFromId3(songs), IMPORT_TIMEOUT_MS, libraryImportMessages.metadataRefreshTimeout);
      if (shouldApplyMetadataRefresh(result.updated)) setSongs(result.songs);
      Alert.alert(libraryImportMessages.metadataUpdatedTitle, metadataRefreshSummary(result.updated, result.skipped, result.failed));
    } catch (error) {
      Alert.alert(libraryImportMessages.metadataUpdateStoppedTitle, error instanceof Error ? error.message : libraryImportMessages.metadataUpdateFallbackError);
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
    <LibraryFolderRow folder={item} onRemove={async folder => setScanFolders(await removeScanFolder(folder.id))} />
  ), []);

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
          onShowFolders={() => { setActiveTab('folders'); setMenuOpen(false); }}
          onOpenSettings={() => { setMenuOpen(false); Alert.alert(librarySettingsMessages.title, librarySettingsMessages.comingSoonMessage); }}
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
