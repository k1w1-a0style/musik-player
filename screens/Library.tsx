import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
  Image,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Grid2X2, Heart, List, MoreVertical, Play, Search, Shuffle } from 'lucide-react-native';
import { useLibraryMusicContext } from '../contexts/MusicContext';
import SongCard from '../components/SongCard';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import LibraryMenuItem from '../components/LibraryMenuItem';
import LibraryFolderRow from '../components/LibraryFolderRow';
import LibraryPlaylistRow from '../components/LibraryPlaylistRow';
import LibraryGroupRow from '../components/LibraryGroupRow';
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
  mergeSongs,
  type LibraryGroupItem,
} from '../utils/libraryPresentation';
import { buildLibraryPlaylistItems, type LibraryPlaylistItem } from '../utils/libraryPlaylists';
import { shuffleItems } from '../utils/libraryShuffle';
import { countActiveScanFolders, getLibraryEmptyMessage, LIBRARY_TABS, type LibraryTab } from '../utils/libraryTabs';
import { filterFavoriteSongs, filterLibrarySongs } from '../utils/librarySongs';
import { buildScanFolderFromDirectoryUri, getEnabledScanFolders } from '../utils/libraryScanFolders';
import { confirmLibraryImport } from '../utils/libraryImportConfirmation';
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
const ALBUM_TILE_HEIGHT = 184;
const IMPORT_TIMEOUT_MS = 90_000;
const isDevDemoSongsEnabled = __DEV__ && process.env.NODE_ENV !== 'test';
const DEMO_SONGS: Song[] = [
  { id: 'demo-1', title: 'SoundHelix Song 1', artist: 'SoundHelix', album: 'Demo', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 'demo-2', title: 'SoundHelix Song 2', artist: 'SoundHelix', album: 'Demo', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: 'demo-3', title: 'SoundHelix Song 3', artist: 'SoundHelix', album: 'Demo', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
];

type AlbumViewMode = 'grid' | 'list';
type GroupItem = LibraryGroupItem;
type PlaylistItem = LibraryPlaylistItem;

const isDemoSong = (song: Song): boolean => song.id.startsWith('demo-');

const withTimeout = async <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

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
  const [albumViewMode, setAlbumViewMode] = useState<AlbumViewMode>('grid');

  useEffect(() => {
    getScanFolders().then(setScanFolders).catch(() => setScanFolders([]));
    getFavoriteSongIds().then(setFavoriteIds).catch(() => setFavoriteIds([]));
  }, []);

  useEffect(() => {
    if (activeTab === 'favorites') getFavoriteSongIds().then(setFavoriteIds).catch(() => setFavoriteIds([]));
  }, [activeTab]);

  const currentSongId = currentSong?.id ?? null;
  const displayedSongs = useMemo(() => (isDevDemoSongsEnabled && isReady && songs.length === 0 ? DEMO_SONGS : songs), [isReady, songs]);
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
      Alert.alert('Nicht unterstützt', 'Die Ordnerauswahl wird aktuell nur unter Android unterstützt.');
      return;
    }
    try {
      const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permission.granted || !permission.directoryUri) {
        Alert.alert('Abgebrochen', 'Es wurde kein Ordner ausgewählt.');
        return;
      }
      const folder = buildScanFolderFromDirectoryUri(permission.directoryUri);
      const next = await addScanFolder(folder);
      if (next.length === scanFolders.length) {
        Alert.alert('Hinweis', 'Dieser Ordner ist bereits in der Scan-Liste.');
        return;
      }
      setScanFolders(next);
      setActiveTab('folders');
    } catch {
      Alert.alert('Nicht unterstützt', 'Die Ordnerauswahl ist auf diesem Gerät nicht verfügbar. Nutze stattdessen den normalen Import.');
    }
  };

  const importFromDevice = async (): Promise<void> => {
    setMenuOpen(false);
    setImportStatus(libraryImportMessages.preparingImport);
    try {
      setLoading(true);
      const activeFolders = getEnabledScanFolders(scanFolders);
      if (activeFolders.length > 0 && Platform.OS === 'android') {
        setImportStatus(scanFoldersReadingStatus(activeFolders.length));
        const result = await withTimeout(importSongsFromSources({ scanFolders: activeFolders, platformOs: Platform.OS }), IMPORT_TIMEOUT_MS, 'Import läuft zu lange. Bitte kleinere Ordner testen oder Ordnerberechtigung neu setzen.');
        setImportStatus(tracksFoundStatus(result.songs.length));
        if (result.folderUpdates) {
          for (const folder of result.folderUpdates) {
            const original = scanFolders.find(item => item.id === folder.id);
            if (!original || original.lastError !== folder.lastError) await updateScanFolder(folder.id, { lastError: folder.lastError });
          }
          setScanFolders(await getScanFolders());
        }
        if (result.songs.length === 0) {
          Alert.alert(
            result.errors.length > 0 ? libraryImportMessages.scanFailedTitle : libraryImportMessages.noMusicFoundTitle,
            result.errors.length > 0 ? libraryImportMessages.scanFailedMessage : libraryImportMessages.noAudioInScanFoldersMessage,
          );
          return;
        }
        if (result.errors.length > 0) Alert.alert(libraryImportMessages.partiallyImportedTitle, libraryImportMessages.partiallyImportedMessage);
        setSongs(mergeSongs(songs, result.songs));
        setActiveTab('tracks');
        return;
      }

      setImportStatus(libraryImportMessages.scanningMediaLibrary);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(libraryImportMessages.permissionRequiredTitle, libraryImportMessages.permissionRequiredMessage);
        return;
      }
      const candidates = await withTimeout(scanMediaLibraryCandidates(), IMPORT_TIMEOUT_MS, 'Medienbibliothek-Scan läuft zu lange.');
      setImportStatus(mediaCandidatesFoundStatus(candidates.assets.length));
      if (candidates.assets.length === 0) {
        Alert.alert(libraryImportMessages.noMusicFoundTitle, libraryImportMessages.noMatchingMusicMessage);
        return;
      }
      const shouldImport = await confirmLibraryImport(candidates.assets.length, candidates.skipped.length);
      if (!shouldImport) return;
      setImportStatus(libraryImportMessages.importingMetadataAndCovers);
      const mediaResult = await withTimeout(enrichMediaLibraryAssets(candidates.assets, candidates.skipped.length), IMPORT_TIMEOUT_MS, 'Metadaten-Import läuft zu lange.');
      setImportStatus(tracksSavingStatus(mediaResult.songs.length));
      setSongs(mergeSongs(songs, mediaResult.songs));
      setActiveTab('tracks');
    } catch (error) {
      Alert.alert(libraryImportMessages.importStoppedTitle, error instanceof Error ? error.message : libraryImportMessages.importFallbackError);
    } finally {
      setLoading(false);
      setImportStatus(null);
    }
  };

  const refreshMetadataFromFiles = async (): Promise<void> => {
    setMenuOpen(false);
    if (songs.length === 0) {
      Alert.alert(libraryImportMessages.noSongsTitle, libraryImportMessages.noSongsMetadataMessage);
      return;
    }
    setImportStatus(libraryImportMessages.readingId3Metadata);
    try {
      setLoading(true);
      const result = await withTimeout(refreshSongsFromId3(songs), IMPORT_TIMEOUT_MS, 'Metadaten-Aktualisierung läuft zu lange. Bitte später erneut versuchen.');
      if (result.updated > 0) setSongs(result.songs);
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
    <Pressable accessibilityRole="button" accessibilityLabel={`${item.title} abspielen`} style={({ pressed }) => [styles.albumTile, pressed && styles.pressed]} onPress={() => item.songs[0] && handleSongPress(item.songs[0], item.songs)}>
      <View style={styles.albumArt}>{item.cover ? <Image source={{ uri: item.cover }} style={styles.albumImage} /> : <Text style={styles.albumLetter}>{item.title.slice(0, 1).toUpperCase()}</Text>}</View>
      <Text style={styles.albumTitle} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.albumSubtitle}>{item.subtitle}</Text>
    </Pressable>
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
        <View style={styles.topBar}>
          <Text style={styles.brand}>K1W1 Music</Text>
          <View style={styles.topActions}>
            <Pressable accessibilityRole="button" accessibilityLabel="Suche öffnen" onPress={() => setSearchOpen(value => !value)} style={styles.iconButton}><Search color={theme.palette.text.primary} size={22} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Mehr Optionen" onPress={() => setMenuOpen(true)} style={styles.iconButton}><MoreVertical color={theme.palette.text.primary} size={22} /></Pressable>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroller} contentContainerStyle={styles.tabsRow}>
          {LIBRARY_TABS.map(tab => {
            const active = activeTab === tab.key;
            return <Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={`${tab.label} anzeigen`} onPress={() => setActiveTab(tab.key)} style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}><Text style={active ? styles.tabActive : styles.tabMuted}>{tab.label}</Text></Pressable>;
          })}
        </ScrollView>

        {searchOpen && <View style={styles.searchWrap}><Search color={theme.palette.text.muted} size={18} /><TextInput value={query} onChangeText={setQuery} placeholder="Titel, Artist, Album, Genre suchen" placeholderTextColor={theme.palette.text.muted} style={styles.searchInput} autoFocus /></View>}
        {loading && <View style={styles.importStatusRow}><ActivityIndicator color={theme.palette.primary} size="small" /><Text style={styles.importStatusText}>{importStatus ?? libraryImportMessages.importRunning}</Text></View>}

        {activeTab === 'folders' ? (
          <View style={styles.listShell}><View style={styles.listHeader}><Text style={styles.sortLabel}>Scan-Ordner</Text><Text style={styles.folderCount}>{activeFolders} aktiv</Text></View><FlatList data={scanFolders} keyExtractor={item => item.id} contentContainerStyle={styles.listContent} renderItem={renderFolderItem} ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>} /></View>
        ) : activeTab === 'albums' ? (
          <View style={styles.listShell}><View style={styles.listHeader}><Text style={styles.sortLabel}>Alben</Text><View style={styles.listHeaderActions}><Text style={styles.folderCount}>{albumGroups.length}</Text><Pressable accessibilityRole="button" accessibilityLabel="Albumansicht wechseln" onPress={() => setAlbumViewMode(mode => mode === 'grid' ? 'list' : 'grid')} style={styles.smallToggle}>{albumViewMode === 'grid' ? <List color={theme.palette.text.secondary} size={16} /> : <Grid2X2 color={theme.palette.text.secondary} size={16} />}</Pressable></View></View>{albumViewMode === 'grid' ? <FlatList data={albumGroups} keyExtractor={item => item.id} contentContainerStyle={styles.albumGridContent} renderItem={renderAlbumTile} numColumns={2} columnWrapperStyle={styles.albumColumn} ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>} /> : <FlatList data={albumGroups} keyExtractor={item => item.id} contentContainerStyle={styles.listContent} renderItem={renderGroupItem} getItemLayout={(_, index) => ({ length: GROUP_ROW_HEIGHT, offset: GROUP_ROW_HEIGHT * index, index })} ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>} />}</View>
        ) : activeTab === 'artists' || activeTab === 'genres' ? (
          <View style={styles.listShell}><View style={styles.listHeader}><Text style={styles.sortLabel}>{activeTab === 'artists' ? 'Interpreten' : 'Genres'}</Text><Text style={styles.folderCount}>{activeTab === 'artists' ? artistGroups.length : genreGroups.length}</Text></View><FlatList data={activeTab === 'artists' ? artistGroups : genreGroups} keyExtractor={item => item.id} contentContainerStyle={styles.listContent} renderItem={renderGroupItem} getItemLayout={(_, index) => ({ length: GROUP_ROW_HEIGHT, offset: GROUP_ROW_HEIGHT * index, index })} ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>} /></View>
        ) : activeTab === 'playlists' ? (
          <View style={styles.listShell}><View style={styles.listHeader}><Text style={styles.sortLabel}>Playlisten</Text><Text style={styles.folderCount}>{playlistItems.length}</Text></View><FlatList data={playlistItems} keyExtractor={item => item.id} contentContainerStyle={styles.listContent} renderItem={renderPlaylistItem} getItemLayout={(_, index) => ({ length: GROUP_ROW_HEIGHT, offset: GROUP_ROW_HEIGHT * index, index })} ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>} /></View>
        ) : (
          <View style={styles.listShell}><View style={styles.listHeader}><Text style={styles.sortLabel}>{activeTab === 'favorites' ? 'Favoriten' : 'Name'}</Text><View style={styles.listHeaderActions}>{activeTab === 'favorites' && <Heart color={theme.palette.primary} size={17} fill={theme.palette.primary} />}<Pressable accessibilityRole="button" accessibilityLabel="Zufällig abspielen" accessibilityState={{ disabled: songsForActiveList.length === 0 }} disabled={songsForActiveList.length === 0} onPress={handleShufflePress} style={({ pressed }) => [styles.roundButton, pressed && styles.pressed, songsForActiveList.length === 0 && styles.disabled]}><Shuffle color={theme.palette.text.primary} size={17} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Abspielen" style={styles.roundButton} onPress={() => songsForActiveList[0] && handleSongPress(songsForActiveList[0], songsForActiveList)}><Play color={theme.palette.text.primary} size={17} /></Pressable></View></View><FlatList data={songsForActiveList} keyExtractor={keyExtractor} contentContainerStyle={styles.listContent} renderItem={renderItem} removeClippedSubviews windowSize={7} initialNumToRender={10} maxToRenderPerBatch={8} updateCellsBatchingPeriod={80} getItemLayout={getItemLayout} ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>} /></View>
        )}

        <Modal transparent animationType="fade" visible={menuOpen} onRequestClose={() => setMenuOpen(false)}>
          <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}><View style={styles.menuCard}><LibraryMenuItem label="Importieren / Rescan" onPress={importFromDevice} disabled={loading || !isReady} /><LibraryMenuItem label="Metadaten aktualisieren" onPress={refreshMetadataFromFiles} disabled={loading || !isReady || songs.length === 0} /><LibraryMenuItem label="Ordner hinzufügen" onPress={onAddScanFolder} /><LibraryMenuItem label={`Aktive Scan-Ordner: ${activeFolders}`} onPress={() => { setActiveTab('folders'); setMenuOpen(false); }} muted /><LibraryMenuItem label="Einstellungen" onPress={() => { setMenuOpen(false); Alert.alert('Einstellungen', 'Theme- und App-Einstellungen kommen im nächsten Schritt.'); }} /></View></Pressable>
        </Modal>
      </Screen>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 0, paddingTop: 8 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 8 },
  brand: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 25, letterSpacing: -0.8 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 38, height: 38, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  tabsScroller: { flexGrow: 0, flexShrink: 0, maxHeight: 48, marginBottom: 8 },
  tabsRow: { alignItems: 'flex-end', gap: 15, paddingHorizontal: 20, paddingRight: 34 },
  tabButton: { paddingVertical: 4 },
  tabMuted: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 14 },
  tabActive: { color: theme.palette.text.primary, fontFamily: theme.fonts.body, fontSize: 23, letterSpacing: -0.8 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 18, paddingHorizontal: 12, marginHorizontal: 20, marginBottom: 8, gap: 8 },
  searchInput: { flex: 1, color: theme.palette.text.primary, fontFamily: theme.fonts.body, paddingVertical: 8, fontSize: 13 },
  importStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.075)' },
  importStatusText: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 12, flex: 1 },
  listShell: { flex: 1, marginTop: 0, marginHorizontal: 0, paddingTop: 10, paddingHorizontal: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: 'rgba(255,255,255,0.055)' },
  listHeader: { height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  sortLabel: { color: theme.palette.text.secondary, fontFamily: theme.fonts.heading, fontSize: 14 },
  folderCount: { color: theme.palette.text.muted, fontFamily: theme.fonts.body, fontSize: 12 },
  listHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  smallToggle: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  roundButton: { width: 36, height: 36, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingBottom: 96 },
  albumGridContent: { paddingBottom: 104 },
  albumColumn: { gap: 12 },
  empty: { color: theme.palette.text.muted, textAlign: 'center', marginTop: 30, fontFamily: theme.fonts.body },
  albumTile: { width: '48%', height: ALBUM_TILE_HEIGHT, marginBottom: 14 },
  albumArt: { aspectRatio: 1, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  albumImage: { width: '100%', height: '100%' },
  albumLetter: { color: theme.palette.primary, fontFamily: theme.fonts.heading, fontSize: 34 },
  albumTitle: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 13, marginTop: 7, lineHeight: 17 },
  albumSubtitle: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 11, marginTop: 2 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
  menuBackdrop: { flex: 1, alignItems: 'flex-end', paddingTop: 54, paddingRight: 24, backgroundColor: 'rgba(0,0,0,0.10)' },
  menuCard: { width: 250, borderRadius: 22, backgroundColor: '#3b3b3f', paddingVertical: 10, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, elevation: 10 },
});

export default Library;
