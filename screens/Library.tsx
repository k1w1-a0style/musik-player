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
import { Grid2X2, Heart, List, ListMusic, MoreVertical, Play, Search, Shuffle } from 'lucide-react-native';
import { useLibraryMusicContext } from '../contexts/MusicContext';
import SongCard from '../components/SongCard';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
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
  displayFolderName,
  displayGenre,
  groupSongs,
  mergeSongs,
  type LibraryGroupItem,
} from '../utils/libraryPresentation';
import { buildLibraryPlaylistItems, type LibraryPlaylistItem } from '../utils/libraryPlaylists';
import { shuffleItems } from '../utils/libraryShuffle';

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

const confirmImport = (found: number, skipped: number): Promise<boolean> =>
  new Promise(resolve => {
    Alert.alert(
      'Musik importieren',
      `${found} Musikdateien gefunden. ${skipped} kurze Audios, Sprachnachrichten oder Systemtöne wurden übersprungen.`,
      [
        { text: 'Abbrechen', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Importieren', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });

const LIBRARY_TABS = [
  { key: 'tracks', label: 'Tracks' },
  { key: 'favorites', label: 'Favoriten' },
  { key: 'playlists', label: 'Playlisten' },
  { key: 'albums', label: 'Alben' },
  { key: 'artists', label: 'Interpreten' },
  { key: 'genres', label: 'Genres' },
  { key: 'folders', label: 'Ordner' },
] as const;

type LibraryTab = (typeof LIBRARY_TABS)[number]['key'];
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

  const filteredSongs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return displayedSongs;
    return displayedSongs.filter(song => [song.title, displayArtist(song), displayAlbum(song), displayGenre(song)].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [displayedSongs, query]);

  const favoriteSongs = useMemo(() => {
    const favoriteSet = new Set(favoriteIds);
    return filteredSongs.filter(song => favoriteSet.has(song.id) || song.favorite);
  }, [favoriteIds, filteredSongs]);
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
      const addedAt = Date.now();
      const id = `${addedAt}-${Math.random().toString(36).slice(2, 8)}`;
      const folder: ScanFolder = {
        id,
        name: displayFolderName({ id, name: '', uri: permission.directoryUri, addedAt, enabled: true }),
        uri: permission.directoryUri,
        addedAt,
        enabled: true,
      };
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
    setImportStatus('Import wird vorbereitet…');
    try {
      setLoading(true);
      const activeFolders = scanFolders.filter(folder => folder.enabled);
      if (activeFolders.length > 0 && Platform.OS === 'android') {
        setImportStatus(`Scan-Ordner werden gelesen… (${activeFolders.length})`);
        const result = await withTimeout(importSongsFromSources({ scanFolders: activeFolders, platformOs: Platform.OS }), IMPORT_TIMEOUT_MS, 'Import läuft zu lange. Bitte kleinere Ordner testen oder Ordnerberechtigung neu setzen.');
        setImportStatus(`${result.songs.length} Tracks gefunden. Bibliothek wird aktualisiert…`);
        if (result.folderUpdates) {
          for (const folder of result.folderUpdates) {
            const original = scanFolders.find(item => item.id === folder.id);
            if (!original || original.lastError !== folder.lastError) await updateScanFolder(folder.id, { lastError: folder.lastError });
          }
          setScanFolders(await getScanFolders());
        }
        if (result.songs.length === 0) {
          Alert.alert(result.errors.length > 0 ? 'Scan fehlgeschlagen' : 'Keine Musik gefunden', result.errors.length > 0 ? 'In den Scan-Ordnern wurden keine importierbaren Songs gefunden. Einige Ordner/Dateien waren nicht lesbar.' : 'In den gewählten Scan-Ordnern wurden keine Audio-Dateien gefunden.');
          return;
        }
        if (result.errors.length > 0) Alert.alert('Teilweise importiert', 'Einige Ordner/Dateien waren nicht lesbar. Importierbare Songs wurden trotzdem übernommen.');
        setSongs(mergeSongs(songs, result.songs));
        setActiveTab('tracks');
        return;
      }

      setImportStatus('Medienbibliothek wird durchsucht…');
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Berechtigung benötigt', 'Ohne Zugriff können keine Songs importiert werden.');
        return;
      }
      const candidates = await withTimeout(scanMediaLibraryCandidates(), IMPORT_TIMEOUT_MS, 'Medienbibliothek-Scan läuft zu lange.');
      setImportStatus(`${candidates.assets.length} Musikdateien gefunden…`);
      if (candidates.assets.length === 0) {
        Alert.alert('Keine Musik gefunden', 'Es wurden keine passenden Musikdateien gefunden.');
        return;
      }
      const shouldImport = await confirmImport(candidates.assets.length, candidates.skipped.length);
      if (!shouldImport) return;
      setImportStatus('Metadaten und Cover werden importiert…');
      const mediaResult = await withTimeout(enrichMediaLibraryAssets(candidates.assets, candidates.skipped.length), IMPORT_TIMEOUT_MS, 'Metadaten-Import läuft zu lange.');
      setImportStatus(`${mediaResult.songs.length} Tracks werden gespeichert…`);
      setSongs(mergeSongs(songs, mediaResult.songs));
      setActiveTab('tracks');
    } catch (error) {
      Alert.alert('Import gestoppt', error instanceof Error ? error.message : 'Medienbibliothek konnte nicht gelesen werden.');
    } finally {
      setLoading(false);
      setImportStatus(null);
    }
  };

  const refreshMetadataFromFiles = async (): Promise<void> => {
    setMenuOpen(false);
    if (songs.length === 0) {
      Alert.alert('Keine Songs', 'Importiere zuerst Musik, bevor Metadaten aktualisiert werden.');
      return;
    }
    setImportStatus('ID3-Metadaten werden gelesen…');
    try {
      setLoading(true);
      const result = await withTimeout(refreshSongsFromId3(songs), IMPORT_TIMEOUT_MS, 'Metadaten-Aktualisierung läuft zu lange. Bitte später erneut versuchen.');
      if (result.updated > 0) setSongs(result.songs);
      Alert.alert('Metadaten aktualisiert', `${result.updated} Tracks aktualisiert. ${result.skipped} übersprungen. ${result.failed} fehlgeschlagen.`);
    } catch (error) {
      Alert.alert('Metadaten-Update gestoppt', error instanceof Error ? error.message : 'Metadaten konnten nicht aktualisiert werden.');
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
    <Pressable accessibilityRole="button" accessibilityLabel={`${item.title} abspielen`} style={({ pressed }) => [styles.groupRow, pressed && styles.pressed]} onPress={() => item.songs[0] && handleSongPress(item.songs[0], item.songs)}>
      <View style={styles.groupIcon}>{item.cover ? <Image source={{ uri: item.cover }} style={styles.groupCover} /> : <Text style={styles.groupIconText}>{item.title.slice(0, 1).toUpperCase()}</Text>}</View>
      <View style={styles.groupTextWrap}><Text style={styles.groupTitle} numberOfLines={1}>{item.title}</Text><Text style={styles.groupSubtitle}>{item.subtitle}</Text></View>
      <Play color={theme.palette.text.secondary} size={16} />
    </Pressable>
  ), [handleSongPress]);

  const renderAlbumTile = useCallback(({ item }: { item: GroupItem }) => (
    <Pressable accessibilityRole="button" accessibilityLabel={`${item.title} abspielen`} style={({ pressed }) => [styles.albumTile, pressed && styles.pressed]} onPress={() => item.songs[0] && handleSongPress(item.songs[0], item.songs)}>
      <View style={styles.albumArt}>{item.cover ? <Image source={{ uri: item.cover }} style={styles.albumImage} /> : <Text style={styles.albumLetter}>{item.title.slice(0, 1).toUpperCase()}</Text>}</View>
      <Text style={styles.albumTitle} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.albumSubtitle}>{item.subtitle}</Text>
    </Pressable>
  ), [handleSongPress]);

  const renderPlaylistItem = useCallback(({ item }: { item: PlaylistItem }) => (
    <View style={styles.playlistRow} testID={`library-playlist-${item.id}`}>
      <View style={styles.groupIcon}><ListMusic color={theme.palette.primary} size={20} /></View>
      <View style={styles.groupTextWrap}>
        <Text style={styles.groupTitle} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.groupSubtitle}>{item.validCount} {item.validCount === 1 ? 'Track' : 'Tracks'}</Text>
        {item.validCount !== item.totalCount && <Text style={styles.playlistWarning}>{item.totalCount - item.validCount} nicht mehr gefunden</Text>}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Playlist ${item.name} abspielen`}
        accessibilityState={{ disabled: item.validCount === 0 }}
        disabled={item.validCount === 0}
        onPress={() => void playPlaylist(item.id)}
        style={({ pressed }) => [styles.roundButton, pressed && styles.pressed, item.validCount === 0 && styles.disabled]}
      >
        <Play color={item.validCount > 0 ? theme.palette.text.primary : theme.palette.text.muted} size={17} />
      </Pressable>
    </View>
  ), [playPlaylist]);

  const activeFolders = scanFolders.filter(folder => folder.enabled).length;
  const emptyMessage = activeTab === 'folders' ? 'Noch keine Scan-Ordner. Über ⋮ kannst du Ordner hinzufügen.' : activeTab === 'favorites' ? 'Noch keine Favoriten markiert.' : activeTab === 'playlists' ? 'Noch keine Playlists angelegt. Nutze den Playlists-Tab unten, um eine neue Liste zu erstellen.' : activeTab === 'albums' ? 'Keine Alben gefunden. Importiere neu, damit Tags/Cover aktualisiert werden.' : activeTab === 'artists' ? 'Keine Interpreten gefunden.' : activeTab === 'genres' ? 'Keine Genres gefunden.' : 'Keine Treffer gefunden.';

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
        {loading && <View style={styles.importStatusRow}><ActivityIndicator color={theme.palette.primary} size="small" /><Text style={styles.importStatusText}>{importStatus ?? 'Import läuft…'}</Text></View>}

        {activeTab === 'folders' ? (
          <View style={styles.listShell}><View style={styles.listHeader}><Text style={styles.sortLabel}>Scan-Ordner</Text><Text style={styles.folderCount}>{activeFolders} aktiv</Text></View><FlatList data={scanFolders} keyExtractor={item => item.id} contentContainerStyle={styles.listContent} renderItem={({ item }) => <View style={styles.folderRow}><View style={styles.folderTextWrap}><Text style={styles.folderName} numberOfLines={1}>{displayFolderName(item)}</Text><Text style={styles.folderMeta} numberOfLines={2}>{item.lastError ?? item.uri}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Scan-Ordner ${displayFolderName(item)} entfernen`} onPress={async () => setScanFolders(await removeScanFolder(item.id))} style={({ pressed }) => [styles.removeFolderButton, pressed && styles.pressed]}><Text style={styles.removeFolderText}>Entfernen</Text></Pressable></View>} ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>} /></View>
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
          <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}><View style={styles.menuCard}><MenuItem label="Importieren / Rescan" onPress={importFromDevice} disabled={loading || !isReady} /><MenuItem label="Metadaten aktualisieren" onPress={refreshMetadataFromFiles} disabled={loading || !isReady || songs.length === 0} /><MenuItem label="Ordner hinzufügen" onPress={onAddScanFolder} /><MenuItem label={`Aktive Scan-Ordner: ${activeFolders}`} onPress={() => { setActiveTab('folders'); setMenuOpen(false); }} muted /><MenuItem label="Einstellungen" onPress={() => { setMenuOpen(false); Alert.alert('Einstellungen', 'Theme- und App-Einstellungen kommen im nächsten Schritt.'); }} /></View></Pressable>
        </Modal>
      </Screen>
    </AppBackground>
  );
};

const MenuItem: React.FC<{ label: string; onPress: () => void; disabled?: boolean; muted?: boolean }> = ({ label, onPress, disabled, muted }) => <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.menuItem, pressed && styles.pressed, disabled && styles.disabled]}><Text style={[styles.menuText, muted && styles.menuTextMuted]}>{label}</Text></Pressable>;

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
  groupRow: { height: GROUP_ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.palette.border },
  groupIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  groupCover: { width: '100%', height: '100%' },
  groupIconText: { color: theme.palette.primary, fontFamily: theme.fonts.heading, fontSize: 18 },
  groupTextWrap: { flex: 1, minWidth: 0 },
  groupTitle: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 15 },
  groupSubtitle: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 12, marginTop: 2 },
  albumTile: { width: '48%', height: ALBUM_TILE_HEIGHT, marginBottom: 14 },
  albumArt: { aspectRatio: 1, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  albumImage: { width: '100%', height: '100%' },
  albumLetter: { color: theme.palette.primary, fontFamily: theme.fonts.heading, fontSize: 34 },
  albumTitle: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 13, marginTop: 7, lineHeight: 17 },
  albumSubtitle: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 11, marginTop: 2 },
  playlistRow: { height: GROUP_ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.palette.border },
  playlistWarning: { color: theme.palette.error, fontFamily: theme.fonts.body, fontSize: 11, marginTop: 2 },
  folderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.palette.border },
  folderTextWrap: { flex: 1, minWidth: 0 },
  folderName: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 14 },
  folderMeta: { color: theme.palette.text.muted, fontFamily: theme.fonts.body, fontSize: 11, marginTop: 2 },
  removeFolderButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)' },
  removeFolderText: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 12 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
  menuBackdrop: { flex: 1, alignItems: 'flex-end', paddingTop: 54, paddingRight: 24, backgroundColor: 'rgba(0,0,0,0.10)' },
  menuCard: { width: 250, borderRadius: 22, backgroundColor: '#3b3b3f', paddingVertical: 10, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, elevation: 10 },
  menuItem: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 22 },
  menuText: { color: '#f4f4f5', fontFamily: theme.fonts.body, fontSize: 18, letterSpacing: -0.3 },
  menuTextMuted: { color: '#b9b9bd', fontSize: 14 },
});

export default Library;
