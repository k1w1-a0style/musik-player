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
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Download, RefreshCcw, Search } from 'lucide-react-native';
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

const SONG_ROW_HEIGHT = 86;
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

const isDemoSong = (song: Song): boolean => song.id.startsWith('demo-');

const Library: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { songs, setSongs, currentSong, playSong, isReady, isPlaying } = useLibraryMusicContext();
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [scanFolders, setScanFolders] = useState<ScanFolder[]>([]);

  useEffect(() => {
    getScanFolders().then(setScanFolders).catch(() => setScanFolders([]));
  }, []);

  const currentSongId = currentSong?.id ?? null;
  const displayedSongs = useMemo(
    () => (isDevDemoSongsEnabled && isReady && songs.length === 0 ? DEMO_SONGS : songs),
    [isReady, songs],
  );

  const filtered = useMemo(() => {
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

  const onAddScanFolder = async (): Promise<void> => {
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
    } catch {
      Alert.alert('Nicht unterstützt', 'Die Ordnerauswahl ist auf diesem Gerät nicht verfügbar. Nutze stattdessen den normalen Import.');
    }
  };

  const importFromDevice = async (): Promise<void> => {
    try {
      setLoading(true);
      const activeFolders = scanFolders.filter(folder => folder.enabled);
      if (activeFolders.length > 0 && Platform.OS === 'android') {
        const result = await importSongsFromSources({ scanFolders: activeFolders, platformOs: Platform.OS });
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
        return;
      }

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Berechtigung benötigt', 'Ohne Zugriff können keine Songs importiert werden.');
        return;
      }
      const candidates = await scanMediaLibraryCandidates();
      if (candidates.assets.length === 0) {
        Alert.alert('Keine Musik gefunden', 'Es wurden keine passenden Musikdateien gefunden.');
        return;
      }
      const shouldImport = await confirmImport(candidates.assets.length, candidates.skipped.length);
      if (!shouldImport) return;
      const mediaResult = await enrichMediaLibraryAssets(candidates.assets, candidates.skipped.length);
      setSongs(mediaResult.songs);
    } catch {
      Alert.alert('Fehler', 'Medienbibliothek konnte nicht gelesen werden.');
    } finally {
      setLoading(false);
    }
  };

  const handleSongPress = useCallback((song: Song) => void playSong(song), [playSong]);
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
        onPressSong={handleSongPress}
        onInfoSong={isDemoSong(item) ? undefined : handleInfoSong}
      />
    ),
    [currentSongId, handleInfoSong, handleSongPress, isPlaying],
  );

  return (
    <AppBackground>
      <Screen testID="library-screen" contentStyle={styles.container}>
        <View style={styles.topBar}>
          <Text style={styles.brand}><Text style={styles.brandMuted}>K1W1</Text> Music</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Musik importieren"
            accessibilityState={{ disabled: loading || !isReady }}
            style={({ pressed }) => [styles.iconButton, (loading || !isReady) && styles.disabled, pressed && styles.pressed]}
            onPress={importFromDevice}
            disabled={loading || !isReady}
          >
            {loading ? (
              <ActivityIndicator color={theme.palette.text.primary} />
            ) : songs.length > 0 ? (
              <RefreshCcw color={theme.palette.text.primary} size={22} />
            ) : (
              <Download color={theme.palette.text.primary} size={22} />
            )}
          </Pressable>
        </View>

        <View style={styles.tabsRow}>
          <Text style={styles.tabMuted}>Favoriten</Text>
          <Text style={styles.tabMuted}>Playlists</Text>
          <Text style={styles.tabActive}>Tracks</Text>
          <Text style={styles.tabMuted}>Artists</Text>
        </View>

        <View style={styles.searchWrap}>
          <Search color={theme.palette.text.muted} size={18} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Titel, Artist, Album suchen" placeholderTextColor={theme.palette.text.muted} style={styles.searchInput} />
        </View>

        <View style={styles.scanFoldersCard}>
          <View style={styles.scanFoldersHeader}>
            <Text style={styles.scanFoldersTitle}>Scan-Ordner</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Scan-Ordner hinzufügen" onPress={onAddScanFolder} style={styles.scanFoldersAddButton}>
              <Text style={styles.scanFoldersAddText}>Ordner hinzufügen</Text>
            </Pressable>
          </View>
          {scanFolders.length === 0 ? <Text style={styles.scanFoldersEmpty}>Keine Ordner ausgewählt</Text> : scanFolders.map(folder => (
            <View key={folder.id} style={styles.scanFolderRow}>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: folder.enabled }} onPress={async () => setScanFolders(await updateScanFolder(folder.id, { enabled: !folder.enabled }))}>
                <Text style={styles.scanFolderToggle}>{folder.enabled ? '☑' : '☐'}</Text>
              </Pressable>
              <Text style={styles.scanFolderName} numberOfLines={1}>{folder.name}</Text>
              <Pressable onPress={async () => setScanFolders(await removeScanFolder(folder.id))}><Text style={styles.scanFolderRemove}>Entfernen</Text></Pressable>
            </View>
          ))}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          renderItem={renderItem}
          removeClippedSubviews
          windowSize={7}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          updateCellsBatchingPeriod={100}
          getItemLayout={getItemLayout}
          ListHeaderComponent={<Text style={styles.countLabel}>{displayedSongs.length} Titel</Text>}
          ListEmptyComponent={<Text style={styles.empty}>Keine Treffer gefunden.</Text>}
        />
      </Screen>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: theme.spacing.md, paddingTop: 8 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  brand: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 25, letterSpacing: -0.6 },
  brandMuted: { color: theme.palette.text.secondary, fontSize: 14, letterSpacing: 0.5 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  tabsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 28, marginBottom: 18 },
  tabMuted: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 18 },
  tabActive: { color: theme.palette.text.primary, fontFamily: theme.fonts.display, fontSize: 34, letterSpacing: -1.2 },
  countLabel: { color: theme.palette.text.muted, fontFamily: theme.fonts.body, fontSize: 12, marginBottom: 8, marginLeft: 4 },
  scanFoldersCard: { backgroundColor: 'rgba(255,255,255,0.035)', borderRadius: 26, padding: 12, marginBottom: 12 },
  scanFoldersHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scanFoldersTitle: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 14 },
  scanFoldersAddButton: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: theme.palette.surface, borderRadius: theme.radii.input },
  scanFoldersAddText: { color: theme.palette.primary, fontFamily: theme.fonts.body, fontSize: 12 },
  scanFoldersEmpty: { color: theme.palette.text.muted, marginTop: 6, fontFamily: theme.fonts.body },
  scanFolderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  scanFolderToggle: { color: theme.palette.text.primary, fontSize: 16 },
  scanFolderName: { flex: 1, color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 12 },
  scanFolderRemove: { color: '#f87171', fontFamily: theme.fonts.body, fontSize: 12 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.055)', borderRadius: 22, paddingHorizontal: 14, marginBottom: 12, gap: 8 },
  searchInput: { flex: 1, color: theme.palette.text.primary, fontFamily: theme.fonts.body, paddingVertical: 11, fontSize: 14 },
  listContent: { paddingBottom: 128 },
  empty: { color: theme.palette.text.muted, textAlign: 'center', marginTop: 30, fontFamily: theme.fonts.body },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.85 },
});

export default Library;
