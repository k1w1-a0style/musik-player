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
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MoreVertical, Play, Search, Shuffle } from 'lucide-react-native';
import { useLibraryMusicContext } from '../contexts/MusicContext';
import SongCard from '../components/SongCard';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import type { Song } from '../types/Song';
import { theme } from '../theme';
import { deriveFolderNameFromUri, importSongsFromSources, scanMediaLibraryCandidates, enrichMediaLibraryAssets } from '../utils/mediaLibraryImport';
import type { AppStackParamList } from '../types/navigation';
import type { ScanFolder } from '../types/ScanFolder';
import { addScanFolder, getScanFolders, removeScanFolder, updateScanFolder } from '../utils/storage';
import { APP_STACK_ROUTES } from '../types/routes';

declare const __DEV__: boolean;

const SONG_ROW_HEIGHT = 62;
const GROUP_ROW_HEIGHT = 66;
const IMPORT_TIMEOUT_MS = 90_000;
const isDevDemoSongsEnabled = __DEV__ && process.env.NODE_ENV !== 'test';
const DEMO_SONGS: Song[] = [
  {
    id: 'demo-1',
    title: 'SoundHelix Song 1',
    artist: 'SoundHelix',
    album: 'Demo',
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  },
  {
    id: 'demo-2',
    title: 'SoundHelix Song 2',
    artist: 'SoundHelix',
    album: 'Demo',
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  },
  {
    id: 'demo-3',
    title: 'SoundHelix Song 3',
    artist: 'SoundHelix',
    album: 'Demo',
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  },
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
  { key: 'playlists', label: 'Playlisten' },
  { key: 'albums', label: 'Alben' },
  { key: 'artists', label: 'Interpreten' },
  { key: 'folders', label: 'Ordner' },
] as const;

type LibraryTab = (typeof LIBRARY_TABS)[number]['key'];

type GroupItem = {
  id: string;
  title: string;
  subtitle: string;
  songs: Song[];
};

const isDemoSong = (song: Song): boolean => song.id.startsWith('demo-');

const mergeSongs = (existingSongs: Song[], importedSongs: Song[]): Song[] => {
  const byKey = new Map<string, Song>();
  [...existingSongs, ...importedSongs].forEach(song => {
    const key = song.uri ?? song.id;
    byKey.set(key, { ...byKey.get(key), ...song });
  });
  return Array.from(byKey.values()).sort((a, b) => a.title.localeCompare(b.title));
};

const groupSongs = (songs: Song[], field: 'album' | 'artist'): GroupItem[] => {
  const grouped = new Map<string, Song[]>();
  for (const song of songs) {
    const label = song[field]?.trim() || (field === 'album' ? 'Unbekanntes Album' : 'Unbekannter Interpret');
    grouped.set(label, [...(grouped.get(label) ?? []), song]);
  }
  return Array.from(grouped.entries())
    .map(([title, list]) => ({
      id: `${field}:${title}`,
      title,
      subtitle: `${list.length} ${list.length === 1 ? 'Track' : 'Tracks'}`,
      songs: list.sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
};

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
  const { songs, setSongs, currentSong, playSong, isReady, isPlaying } = useLibraryMusicContext();
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [scanFolders, setScanFolders] = useState<ScanFolder[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<LibraryTab>('tracks');

  useEffect(() => {
    getScanFolders().then(setScanFolders).catch(() => setScanFolders([]));
  }, []);

  const currentSongId = currentSong?.id ?? null;
  const displayedSongs = useMemo(
    () => (isDevDemoSongsEnabled && isReady && songs.length === 0 ? DEMO_SONGS : songs),
    [isReady, songs],
  );

  const filteredSongs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return displayedSongs;

    return displayedSongs.filter(song =>
      [song.title, song.artist, song.album]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [displayedSongs, query]);

  const albumGroups = useMemo(() => groupSongs(filteredSongs, 'album'), [filteredSongs]);
  const artistGroups = useMemo(() => groupSongs(filteredSongs, 'artist'), [filteredSongs]);

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
        const result = await withTimeout(
          importSongsFromSources({ scanFolders: activeFolders, platformOs: Platform.OS }),
          IMPORT_TIMEOUT_MS,
          'Import läuft zu lange. Bitte kleinere Ordner testen oder Ordnerberechtigung neu setzen.',
        );
        setImportStatus(`${result.songs.length} Tracks gefunden. Bibliothek wird aktualisiert…`);
        if (result.folderUpdates) {
          for (const folder of result.folderUpdates) {
            const original = scanFolders.find(item => item.id === folder.id);
            if (!original || original.lastError !== folder.lastError) {
              await updateScanFolder(folder.id, { lastError: folder.lastError });
            }
          }
          setScanFolders(await getScanFolders());
        }
        if (result.songs.length === 0) {
          Alert.alert(
            result.errors.length > 0 ? 'Scan fehlgeschlagen' : 'Keine Musik gefunden',
            result.errors.length > 0
              ? 'In den Scan-Ordnern wurden keine importierbaren Songs gefunden. Einige Ordner/Dateien waren nicht lesbar.'
              : 'In den gewählten Scan-Ordnern wurden keine Audio-Dateien gefunden.',
          );
          return;
        }
        if (result.errors.length > 0) Alert.alert('Teilweise importiert', 'Einige Ordner/Dateien waren nicht lesbar. Importierbare Songs wurden trotzdem übernommen.');
        setSongs(result.songs);
        setActiveTab('tracks');
        return;
      }

      setImportStatus('Medienbibliothek wird durchsucht…');
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Berechtigung benötigt', 'Ohne Zugriff können keine Songs importiert werden.');
        return;
      }
      const candidates = await withTimeout(
        scanMediaLibraryCandidates(),
        IMPORT_TIMEOUT_MS,
        'Medienbibliothek-Scan läuft zu lange.',
      );
      setImportStatus(`${candidates.assets.length} Musikdateien gefunden…`);
      if (candidates.assets.length === 0) {
        Alert.alert('Keine Musik gefunden', 'Es wurden keine passenden Musikdateien gefunden.');
        return;
      }
      const shouldImport = await confirmImport(candidates.assets.length, candidates.skipped.length);
      if (!shouldImport) return;
      setImportStatus('Metadaten und Cover werden importiert…');
      const mediaResult = await withTimeout(
        enrichMediaLibraryAssets(candidates.assets, candidates.skipped.length),
        IMPORT_TIMEOUT_MS,
        'Metadaten-Import läuft zu lange.',
      );
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

  const handleSongPress = useCallback((song: Song, queue: Song[] = filteredSongs) => void playSong(song, queue), [filteredSongs, playSong]);
  const handleInfoSong = useCallback((song: Song) => navigation.navigate(APP_STACK_ROUTES.TRACK_INFO, { songId: song.id }), [navigation]);
  const keyExtractor = useCallback((item: Song) => item.id, []);
  const getItemLayout = useCallback((_: ArrayLike<Song> | null | undefined, index: number) => ({
    length: SONG_ROW_HEIGHT,
    offset: SONG_ROW_HEIGHT * index,
    index,
  }), []);

  const renderItem = useCallback(
    ({ item }: { item: Song }) => (
      <SongCard
        song={item}
        isCurrent={currentSongId === item.id}
        isPlaying={currentSongId === item.id && isPlaying}
        onPressSong={song => handleSongPress(song, filteredSongs)}
        onInfoSong={isDemoSong(item) ? undefined : handleInfoSong}
      />
    ),
    [currentSongId, filteredSongs, handleInfoSong, handleSongPress, isPlaying],
  );

  const renderGroupItem = useCallback(
    ({ item }: { item: GroupItem }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.title} abspielen`}
        style={({ pressed }) => [styles.groupRow, pressed && styles.pressed]}
        onPress={() => item.songs[0] && handleSongPress(item.songs[0], item.songs)}
      >
        <View style={styles.groupIcon}>
          <Text style={styles.groupIconText}>{item.title.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.groupTextWrap}>
          <Text style={styles.groupTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.groupSubtitle}>{item.subtitle}</Text>
        </View>
        <Play color={theme.palette.text.secondary} size={16} />
      </Pressable>
    ),
    [handleSongPress],
  );

  const activeFolders = scanFolders.filter(folder => folder.enabled).length;
  const emptyMessage =
    activeTab === 'folders'
      ? 'Noch keine Scan-Ordner. Über ⋮ kannst du Ordner hinzufügen.'
      : activeTab === 'albums'
        ? 'Keine Alben gefunden. Importiere neu, damit Tags/Cover aktualisiert werden.'
        : activeTab === 'artists'
          ? 'Keine Interpreten gefunden.'
          : 'Keine Treffer gefunden.';

  return (
    <AppBackground>
      <Screen testID="library-screen" contentStyle={styles.container}>
        <View style={styles.topBar}>
          <Text style={styles.brand}>K1W1 Music</Text>
          <View style={styles.topActions}>
            <Pressable accessibilityRole="button" accessibilityLabel="Suche öffnen" onPress={() => setSearchOpen(value => !value)} style={styles.iconButton}>
              <Search color={theme.palette.text.primary} size={22} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Mehr Optionen" onPress={() => setMenuOpen(true)} style={styles.iconButton}>
              <MoreVertical color={theme.palette.text.primary} size={22} />
            </Pressable>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          {LIBRARY_TABS.map(tab => {
            const active = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${tab.label} anzeigen`}
                onPress={() => setActiveTab(tab.key)}
                style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}
              >
                <Text style={active ? styles.tabActive : styles.tabMuted}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {searchOpen && (
          <View style={styles.searchWrap}>
            <Search color={theme.palette.text.muted} size={18} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Titel, Artist, Album suchen" placeholderTextColor={theme.palette.text.muted} style={styles.searchInput} autoFocus />
          </View>
        )}

        {loading && (
          <View style={styles.importStatusRow}>
            <ActivityIndicator color={theme.palette.primary} size="small" />
            <Text style={styles.importStatusText}>{importStatus ?? 'Import läuft…'}</Text>
          </View>
        )}

        {activeTab === 'folders' ? (
          <View style={styles.listShell}>
            <View style={styles.listHeader}>
              <Text style={styles.sortLabel}>Scan-Ordner</Text>
              <Text style={styles.folderCount}>{activeFolders} aktiv</Text>
            </View>
            <FlatList
              data={scanFolders}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <View style={styles.folderRow}>
                  <View style={styles.folderTextWrap}>
                    <Text style={styles.folderName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.folderMeta} numberOfLines={2}>{item.lastError ?? item.uri}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Scan-Ordner ${item.name} entfernen`}
                    onPress={async () => {
                      const next = await removeScanFolder(item.id);
                      setScanFolders(next);
                    }}
                    style={({ pressed }) => [styles.removeFolderButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.removeFolderText}>Entfernen</Text>
                  </Pressable>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>}
            />
          </View>
        ) : activeTab === 'albums' || activeTab === 'artists' ? (
          <View style={styles.listShell}>
            <View style={styles.listHeader}>
              <Text style={styles.sortLabel}>{activeTab === 'albums' ? 'Alben' : 'Interpreten'}</Text>
              <Text style={styles.folderCount}>{activeTab === 'albums' ? albumGroups.length : artistGroups.length}</Text>
            </View>
            <FlatList
              data={activeTab === 'albums' ? albumGroups : artistGroups}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={renderGroupItem}
              getItemLayout={(_, index) => ({ length: GROUP_ROW_HEIGHT, offset: GROUP_ROW_HEIGHT * index, index })}
              ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>}
            />
          </View>
        ) : activeTab === 'playlists' ? (
          <View style={styles.listShell}>
            <View style={styles.listHeader}>
              <Text style={styles.sortLabel}>Playlisten</Text>
            </View>
            <Text style={styles.empty}>Playlisten-Verwaltung kommt in den nächsten Schritt. Vorhandene Playlists bleiben erhalten.</Text>
          </View>
        ) : (
          <View style={styles.listShell}>
            <View style={styles.listHeader}>
              <Text style={styles.sortLabel}>Name</Text>
              <View style={styles.listHeaderActions}>
                <Pressable accessibilityRole="button" accessibilityLabel="Zufällig abspielen" style={styles.roundButton}>
                  <Shuffle color={theme.palette.text.primary} size={17} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Abspielen" style={styles.roundButton} onPress={() => filteredSongs[0] && handleSongPress(filteredSongs[0], filteredSongs)}>
                  <Play color={theme.palette.text.primary} size={17} />
                </Pressable>
              </View>
            </View>
            <FlatList
              data={filteredSongs}
              keyExtractor={keyExtractor}
              contentContainerStyle={styles.listContent}
              renderItem={renderItem}
              removeClippedSubviews
              windowSize={5}
              initialNumToRender={8}
              maxToRenderPerBatch={6}
              updateCellsBatchingPeriod={120}
              getItemLayout={getItemLayout}
              ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>}
            />
          </View>
        )}

        <Modal transparent animationType="fade" visible={menuOpen} onRequestClose={() => setMenuOpen(false)}>
          <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
            <View style={styles.menuCard}>
              <MenuItem label="Importieren / Rescan" onPress={importFromDevice} disabled={loading || !isReady} />
              <MenuItem label="Ordner hinzufügen" onPress={onAddScanFolder} />
              <MenuItem label={`Aktive Scan-Ordner: ${activeFolders}`} onPress={() => { setActiveTab('folders'); setMenuOpen(false); }} muted />
              <MenuItem label="Einstellungen" onPress={() => { setMenuOpen(false); Alert.alert('Einstellungen', 'Theme- und App-Einstellungen kommen im nächsten Schritt.'); }} />
            </View>
          </Pressable>
        </Modal>
      </Screen>
    </AppBackground>
  );
};

const MenuItem: React.FC<{ label: string; onPress: () => void; disabled?: boolean; muted?: boolean }> = ({ label, onPress, disabled, muted }) => (
  <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.menuItem, pressed && styles.pressed, disabled && styles.disabled]}>
    <Text style={[styles.menuText, muted && styles.menuTextMuted]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 0, paddingTop: 8 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 18 },
  brand: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 25, letterSpacing: -0.8 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 38, height: 38, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  tabsRow: { alignItems: 'flex-end', gap: 18, marginBottom: 10, paddingHorizontal: 20, paddingRight: 34 },
  tabButton: { paddingVertical: 4 },
  tabMuted: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 15 },
  tabActive: { color: theme.palette.text.primary, fontFamily: theme.fonts.body, fontSize: 28, letterSpacing: -0.8 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 18, paddingHorizontal: 12, marginHorizontal: 20, marginBottom: 12, gap: 8 },
  searchInput: { flex: 1, color: theme.palette.text.primary, fontFamily: theme.fonts.body, paddingVertical: 8, fontSize: 13 },
  importStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.075)' },
  importStatusText: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 12, flex: 1 },
  listShell: { flex: 1, marginTop: 2, marginHorizontal: 0, paddingTop: 12, paddingHorizontal: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: 'rgba(255,255,255,0.055)' },
  listHeader: { height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  sortLabel: { color: theme.palette.text.secondary, fontFamily: theme.fonts.heading, fontSize: 14 },
  folderCount: { color: theme.palette.text.muted, fontFamily: theme.fonts.body, fontSize: 12 },
  listHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roundButton: { width: 36, height: 36, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingBottom: 96 },
  empty: { color: theme.palette.text.muted, textAlign: 'center', marginTop: 30, fontFamily: theme.fonts.body },
  groupRow: { height: GROUP_ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.palette.border },
  groupIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  groupIconText: { color: theme.palette.primary, fontFamily: theme.fonts.heading, fontSize: 18 },
  groupTextWrap: { flex: 1, minWidth: 0 },
  groupTitle: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 15 },
  groupSubtitle: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 12, marginTop: 2 },
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
