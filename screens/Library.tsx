import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Heart, MoreVertical, Play, Search, Shuffle } from 'lucide-react-native';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import SongCard from '../components/SongCard';
import { useLibraryMusicContext } from '../contexts/MusicContext';
import { theme } from '../theme';
import type { AppStackParamList } from '../types/navigation';
import { APP_STACK_ROUTES } from '../types/routes';
import type { ScanFolder } from '../types/ScanFolder';
import type { Song } from '../types/Song';
import { deriveFolderNameFromUri, enrichMediaLibraryAssets, importSongsFromSources, scanMediaLibraryCandidates } from '../utils/mediaLibraryImport';
import { addScanFolder, getFavoriteSongIds, getScanFolders, removeScanFolder, updateScanFolder } from '../utils/storage';

const SONG_ROW_HEIGHT = 62;
const IMPORT_TIMEOUT_MS = 90_000;

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
type GroupItem = { id: string; title: string; subtitle: string; songs: Song[] };

const confirmImport = (found: number, skipped: number): Promise<boolean> => new Promise(resolve => {
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

const basename = (value?: string): string => {
  if (!value) return '';
  const cleaned = value.replace(/\\/g, '/').replace(/\/+$/, '');
  return cleaned.split('/').filter(Boolean).pop() ?? cleaned;
};
const stripExtension = (value: string): string => value.replace(/\.[^.]+$/, '');
const cleanLabel = (value?: string): string => {
  const raw = value?.trim();
  if (!raw) return '';
  if (!raw.includes('primary:') && !raw.includes('content://')) return raw;
  return stripExtension(basename(raw)) || raw;
};
const displayArtist = (song: Song): string => cleanLabel(song.artist) || 'Unbekannt';
const displayAlbum = (song: Song): string => cleanLabel(song.album) || 'Unbekanntes Album';
const displayGenre = (song: Song): string => cleanLabel(song.genre) || 'Unbekanntes Genre';
const displayFolderName = (folder: ScanFolder): string => deriveFolderNameFromUri(folder.uri) || folder.name || 'Ordner';

const mergeSongs = (existingSongs: Song[], importedSongs: Song[]): Song[] => {
  const byKey = new Map<string, Song>();
  [...existingSongs, ...importedSongs].forEach(song => {
    const key = song.uri ?? song.id;
    byKey.set(key, { ...byKey.get(key), ...song });
  });
  return Array.from(byKey.values()).sort((a, b) => a.title.localeCompare(b.title));
};

const groupSongs = (songs: Song[], kind: 'album' | 'artist' | 'genre'): GroupItem[] => {
  const groups = new Map<string, Song[]>();
  songs.forEach(song => {
    const title = kind === 'album' ? displayAlbum(song) : kind === 'artist' ? displayArtist(song) : displayGenre(song);
    groups.set(title, [...(groups.get(title) ?? []), song]);
  });
  return Array.from(groups.entries()).map(([title, list]) => ({
    id: `${kind}:${title}`,
    title,
    subtitle: `${list.length} ${list.length === 1 ? 'Track' : 'Tracks'}`,
    songs: list.sort((a, b) => a.title.localeCompare(b.title)),
  })).sort((a, b) => a.title.localeCompare(b.title));
};

const withTimeout = async <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const Library: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { songs, setSongs, currentSong, playSong, isReady, isPlaying } = useLibraryMusicContext();
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [scanFolders, setScanFolders] = useState<ScanFolder[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<LibraryTab>('tracks');

  useEffect(() => {
    getScanFolders().then(setScanFolders).catch(() => setScanFolders([]));
    getFavoriteSongIds().then(setFavoriteIds).catch(() => setFavoriteIds([]));
  }, []);

  useEffect(() => {
    if (activeTab === 'favorites') getFavoriteSongIds().then(setFavoriteIds).catch(() => setFavoriteIds([]));
  }, [activeTab]);

  const filteredSongs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter(song => [song.title, displayArtist(song), displayAlbum(song), displayGenre(song)].join(' ').toLowerCase().includes(q));
  }, [query, songs]);

  const favoriteSongs = useMemo(() => {
    const favoriteSet = new Set(favoriteIds);
    return filteredSongs.filter(song => favoriteSet.has(song.id) || song.favorite);
  }, [favoriteIds, filteredSongs]);

  const albumGroups = useMemo(() => groupSongs(filteredSongs, 'album'), [filteredSongs]);
  const artistGroups = useMemo(() => groupSongs(filteredSongs, 'artist'), [filteredSongs]);
  const genreGroups = useMemo(() => groupSongs(filteredSongs, 'genre'), [filteredSongs]);
  const songsForActiveList = activeTab === 'favorites' ? favoriteSongs : filteredSongs;
  const activeFolders = scanFolders.filter(folder => folder.enabled).length;
  const currentSongId = currentSong?.id ?? null;

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
      const folder: ScanFolder = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: deriveFolderNameFromUri(permission.directoryUri),
        uri: permission.directoryUri,
        addedAt: Date.now(),
        enabled: true,
      };
      const next = await addScanFolder(folder);
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
      const activeScanFolders = scanFolders.filter(folder => folder.enabled);
      if (activeScanFolders.length > 0 && Platform.OS === 'android') {
        setImportStatus(`Scan-Ordner werden gelesen… (${activeScanFolders.length})`);
        const result = await withTimeout(importSongsFromSources({ scanFolders: activeScanFolders, platformOs: Platform.OS }), IMPORT_TIMEOUT_MS, 'Import läuft zu lange. Bitte kleinere Ordner testen oder Ordnerberechtigung neu setzen.');
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
      if (candidates.assets.length === 0) {
        Alert.alert('Keine Musik gefunden', 'Es wurden keine passenden Musikdateien gefunden.');
        return;
      }
      const shouldImport = await confirmImport(candidates.assets.length, candidates.skipped.length);
      if (!shouldImport) return;
      setImportStatus('Metadaten und Cover werden importiert…');
      const mediaResult = await withTimeout(enrichMediaLibraryAssets(candidates.assets, candidates.skipped.length), IMPORT_TIMEOUT_MS, 'Metadaten-Import läuft zu lange.');
      setSongs(mergeSongs(songs, mediaResult.songs));
      setActiveTab('tracks');
    } catch (error) {
      Alert.alert('Import gestoppt', error instanceof Error ? error.message : 'Medienbibliothek konnte nicht gelesen werden.');
    } finally {
      setLoading(false);
      setImportStatus(null);
    }
  };

  const handleSongPress = useCallback((song: Song, queue: Song[] = filteredSongs) => void playSong(song, queue), [filteredSongs, playSong]);
  const handleInfoSong = useCallback((song: Song) => navigation.navigate(APP_STACK_ROUTES.TRACK_INFO, { songId: song.id }), [navigation]);
  const handleShufflePress = useCallback(() => {
    if (songsForActiveList.length === 0) return;
    const shuffled = songsForActiveList.slice();
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    void playSong(shuffled[0], shuffled);
  }, [playSong, songsForActiveList]);

  const renderSong = useCallback(({ item }: { item: Song }) => (
    <SongCard
      song={{ ...item, artist: displayArtist(item), album: displayAlbum(item) }}
      isCurrent={currentSongId === item.id}
      isPlaying={currentSongId === item.id && isPlaying}
      onPressSong={song => handleSongPress(song, filteredSongs)}
      onInfoSong={handleInfoSong}
    />
  ), [currentSongId, filteredSongs, handleInfoSong, handleSongPress, isPlaying]);

  const renderGroup = useCallback(({ item }: { item: GroupItem }) => (
    <Pressable accessibilityRole="button" accessibilityLabel={`${item.title} abspielen`} onPress={() => item.songs[0] && handleSongPress(item.songs[0], item.songs)} style={({ pressed }) => [styles.groupRow, pressed && styles.pressed]}>
      <View style={styles.groupIcon}><Text style={styles.groupIconText}>{item.title.slice(0, 1).toUpperCase()}</Text></View>
      <View style={styles.groupTextWrap}><Text style={styles.groupTitle} numberOfLines={1}>{item.title}</Text><Text style={styles.groupSubtitle}>{item.subtitle}</Text></View>
      <Play color={theme.palette.text.secondary} size={16} />
    </Pressable>
  ), [handleSongPress]);

  const emptyMessage = activeTab === 'folders' ? 'Noch keine Scan-Ordner. Über ⋮ kannst du Ordner hinzufügen.' : activeTab === 'favorites' ? 'Noch keine Favoriten markiert.' : 'Keine Treffer gefunden.';

  const renderContent = (): React.ReactNode => {
    if (activeTab === 'folders') {
      return <View style={styles.listShell}><View style={styles.listHeader}><Text style={styles.sortLabel}>Scan-Ordner</Text><Text style={styles.folderCount}>{activeFolders} aktiv</Text></View><FlatList data={scanFolders} keyExtractor={item => item.id} contentContainerStyle={styles.listContent} renderItem={({ item }) => <View style={styles.folderRow}><View style={styles.groupTextWrap}><Text style={styles.groupTitle}>{displayFolderName(item)}</Text><Text style={styles.groupSubtitle}>{item.lastError ?? item.uri}</Text></View><Pressable onPress={async () => setScanFolders(await removeScanFolder(item.id))}><Text style={styles.removeFolderText}>Entfernen</Text></Pressable></View>} ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>} /></View>;
    }
    if (activeTab === 'albums' || activeTab === 'artists' || activeTab === 'genres') {
      const groups = activeTab === 'albums' ? albumGroups : activeTab === 'artists' ? artistGroups : genreGroups;
      return <View style={styles.listShell}><View style={styles.listHeader}><Text style={styles.sortLabel}>{activeTab === 'albums' ? 'Alben' : activeTab === 'artists' ? 'Interpreten' : 'Genres'}</Text><Text style={styles.folderCount}>{groups.length}</Text></View><FlatList data={groups} keyExtractor={item => item.id} renderItem={renderGroup} contentContainerStyle={styles.listContent} ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>} /></View>;
    }
    if (activeTab === 'playlists') {
      return <View style={styles.listShell}><View style={styles.listHeader}><Text style={styles.sortLabel}>Playlisten</Text></View><Text style={styles.empty}>Playlisten-Verwaltung kommt im nächsten UI-Block.</Text></View>;
    }
    return <View style={styles.listShell}><View style={styles.listHeader}><Text style={styles.sortLabel}>{activeTab === 'favorites' ? 'Favoriten' : 'Name'}</Text><View style={styles.listHeaderActions}>{activeTab === 'favorites' && <Heart color={theme.palette.primary} size={17} fill={theme.palette.primary} />}<Pressable accessibilityRole="button" accessibilityLabel="Zufällig abspielen" accessibilityState={{ disabled: songsForActiveList.length === 0 }} disabled={songsForActiveList.length === 0} onPress={handleShufflePress} style={({ pressed }) => [styles.roundButton, pressed && styles.pressed, songsForActiveList.length === 0 && styles.disabled]}><Shuffle color={theme.palette.text.primary} size={17} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Abspielen" onPress={() => songsForActiveList[0] && handleSongPress(songsForActiveList[0], songsForActiveList)} style={styles.roundButton}><Play color={theme.palette.text.primary} size={17} /></Pressable></View></View><FlatList data={songsForActiveList} keyExtractor={item => item.id} renderItem={renderSong} contentContainerStyle={styles.listContent} getItemLayout={(_, index) => ({ length: SONG_ROW_HEIGHT, offset: SONG_ROW_HEIGHT * index, index })} removeClippedSubviews windowSize={7} initialNumToRender={10} maxToRenderPerBatch={8} ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>} /></View>;
  };

  return (
    <AppBackground>
      <Screen testID="library-screen" contentStyle={styles.container}>
        <View style={styles.topBar}><Text style={styles.brand}>K1W1 Music</Text><View style={styles.topActions}><Pressable accessibilityRole="button" accessibilityLabel="Suche öffnen" onPress={() => setSearchOpen(value => !value)} style={styles.iconButton}><Search color={theme.palette.text.primary} size={22} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Mehr Optionen" onPress={() => setMenuOpen(true)} style={styles.iconButton}><MoreVertical color={theme.palette.text.primary} size={22} /></Pressable></View></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroller} contentContainerStyle={styles.tabsRow}>{LIBRARY_TABS.map(tab => <Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{ selected: activeTab === tab.key }} accessibilityLabel={`${tab.label} anzeigen`} onPress={() => setActiveTab(tab.key)} style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}><Text style={activeTab === tab.key ? styles.tabActive : styles.tabMuted}>{tab.label}</Text></Pressable>)}</ScrollView>
        {searchOpen && <View style={styles.searchWrap}><Search color={theme.palette.text.muted} size={18} /><TextInput value={query} onChangeText={setQuery} placeholder="Titel, Artist, Album, Genre suchen" placeholderTextColor={theme.palette.text.muted} style={styles.searchInput} autoFocus /></View>}
        {loading && <View style={styles.importStatusRow}><ActivityIndicator color={theme.palette.primary} size="small" /><Text style={styles.importStatusText}>{importStatus ?? 'Import läuft…'}</Text></View>}
        {renderContent()}
        <Modal transparent animationType="fade" visible={menuOpen} onRequestClose={() => setMenuOpen(false)}><Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}><View style={styles.menuCard}><MenuItem label="Importieren / Rescan" onPress={importFromDevice} disabled={loading || !isReady} /><MenuItem label="Ordner hinzufügen" onPress={onAddScanFolder} /><MenuItem label={`Aktive Scan-Ordner: ${activeFolders}`} onPress={() => { setActiveTab('folders'); setMenuOpen(false); }} muted /><MenuItem label="Einstellungen" onPress={() => { setMenuOpen(false); Alert.alert('Einstellungen', 'Theme- und App-Einstellungen kommen im nächsten Schritt.'); }} /></View></Pressable></Modal>
      </Screen>
    </AppBackground>
  );
};

const MenuItem: React.FC<{ label: string; onPress: () => void; disabled?: boolean; muted?: boolean }> = ({ label, onPress, disabled, muted }) => <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.menuItem, pressed && styles.pressed, disabled && styles.disabled]}><Text style={[styles.menuText, muted && styles.menuTextMuted]}>{label}</Text></Pressable>;

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 8 },
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
  listShell: { flex: 1, paddingTop: 10, paddingHorizontal: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: 'rgba(255,255,255,0.055)' },
  listHeader: { height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  sortLabel: { color: theme.palette.text.secondary, fontFamily: theme.fonts.heading, fontSize: 14 },
  folderCount: { color: theme.palette.text.muted, fontFamily: theme.fonts.body, fontSize: 12 },
  listHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roundButton: { width: 36, height: 36, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingBottom: 96 },
  empty: { color: theme.palette.text.muted, textAlign: 'center', marginTop: 30, fontFamily: theme.fonts.body },
  groupRow: { height: 66, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.palette.border },
  groupIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  groupIconText: { color: theme.palette.primary, fontFamily: theme.fonts.heading, fontSize: 18 },
  groupTextWrap: { flex: 1, minWidth: 0 },
  groupTitle: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 15 },
  groupSubtitle: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 12, marginTop: 2 },
  folderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.palette.border },
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
