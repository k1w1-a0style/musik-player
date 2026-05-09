import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Image,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { getInfoAsync, StorageAccessFramework } from 'expo-file-system/legacy';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Download, RefreshCcw, Search, Disc3 } from 'lucide-react-native';
import { useLibraryMusicContext } from '../contexts/MusicContext';
import SongCard from '../components/SongCard';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import type { Song } from '../types/Song';
import { parseId3FromUri, type Id3Tags } from '../utils/id3Parser';
import { parseFilename } from '../utils/musicParser';
import { cacheBase64Cover, isBase64ImageDataUri } from '../utils/coverCache';
import { theme } from '../theme';
import { deriveFolderNameFromUri, readAudioUrisFromSafDirectory, scanAudioAssetsFromMediaLibrary } from '../utils/mediaLibraryImport';
import type { AppStackParamList } from '../types/navigation';
import type { ScanFolder } from '../types/ScanFolder';
import { addScanFolder, getScanFolders, removeScanFolder, updateScanFolder } from '../utils/storage';
import { APP_STACK_ROUTES } from '../types/routes';

declare const __DEV__: boolean;

const SONG_ROW_HEIGHT = 84;
const isDevPerfLoggingEnabled = __DEV__ && process.env.NODE_ENV !== 'test';
const ID3_WORKER_COUNT = 3;

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

const EXTENSION_MIME_MAP: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  webm: 'audio/webm',
};

export const deriveExtension = (input?: string): string | undefined => {
  if (!input) return undefined;
  const clean = input.split('?')[0] ?? input;
  const segment = clean.split('/').pop() ?? clean;
  const dot = segment.lastIndexOf('.');
  if (dot < 0 || dot === segment.length - 1) return undefined;
  return segment.slice(dot + 1).toLowerCase();
};

export const deriveMimeType = (rawMimeType: unknown, extension?: string): string | undefined => {
  if (typeof rawMimeType === 'string') {
    const normalized = rawMimeType.trim().toLowerCase();
    if (normalized.startsWith('audio/') && normalized.includes('/')) return normalized;
  }
  if (!extension) return undefined;
  return EXTENSION_MIME_MAP[extension];
};

const resolveFileSize = async (asset: MediaLibrary.Asset): Promise<number | undefined> => {
  const directSize = (asset as { fileSize?: number }).fileSize;
  if (typeof directSize === 'number' && directSize > 0) return directSize;
  try {
    const info = await getInfoAsync(asset.uri);
    if (info.exists && typeof info.size === 'number' && info.size > 0) return info.size;
  } catch {
    return undefined;
  }
  return undefined;
};

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
  const [previewCoverFailed, setPreviewCoverFailed] = useState(false);
  const [scanFolders, setScanFolders] = useState<ScanFolder[]>([]);
  const renderCountRef = useRef(0);

  useEffect(() => {
    setPreviewCoverFailed(false);
  }, [currentSong?.id, currentSong?.cover]);


  useEffect(() => {
    getScanFolders().then(setScanFolders).catch(() => setScanFolders([]));
  }, []);

  useEffect(() => {
    if (!isDevPerfLoggingEnabled) return;
    renderCountRef.current += 1;
    if (renderCountRef.current <= 20) {
      // eslint-disable-next-line no-console
      console.debug('[perf] Library render', {
        count: renderCountRef.current,
        songs: songs.length,
        currentSongId: currentSong?.id ?? null,
        isPlaying,
        queryLength: query.length,
      });
    }
  });

  const currentSongId = currentSong?.id ?? null;
  const displayedSongs = useMemo(() => (isReady && songs.length === 0 ? DEMO_SONGS : songs), [isReady, songs]);

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
  };

  const importFromDevice = async (): Promise<void> => {
    try {
      setLoading(true);
      const activeFolders = scanFolders.filter(folder => folder.enabled);
      if (activeFolders.length > 0 && Platform.OS === 'android') {
        const safSongs: Song[] = [];
        const failedFolders: string[] = [];
        for (const folder of activeFolders) {
          const { files, errors } = await readAudioUrisFromSafDirectory(folder.uri);
          if (errors.length > 0) failedFolders.push(folder.name);
          for (const uri of files) {
            const fallback = parseFilename(uri.split('/').pop() ?? uri);
            safSongs.push({
              id: uri,
              title: fallback.title || (uri.split('/').pop() ?? 'Unbekannt'),
              artist: fallback.artist || 'Unbekannt',
              uri,
              fileInfo: { uri, source: 'saf', importedAt: Date.now() },
              coverInfo: { status: 'none' },
            });
          }
        }
        if (failedFolders.length > 0) Alert.alert('Einige Ordner nicht lesbar', failedFolders.join(', '));
        const uniqueSongs = Array.from(new Map(safSongs.map(song => [song.uri, song])).values());
        if (uniqueSongs.length === 0) {
          Alert.alert('Keine Musik gefunden', 'In den gewählten Scan-Ordnern wurden keine Audio-Dateien gefunden.');
          return;
        }
        uniqueSongs.sort((a, b) => a.title.localeCompare(b.title));
        setSongs(uniqueSongs);
        return;
      }


      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Berechtigung benötigt', 'Ohne Zugriff können keine Songs importiert werden.');
        return;
      }

      const scan = await scanAudioAssetsFromMediaLibrary();
      const assets = scan.assets;
      if (assets.length === 0) {
        Alert.alert('Keine Musik gefunden', 'Es wurden keine passenden Musikdateien gefunden.');
        return;
      }

      const shouldImport = await confirmImport(assets.length, scan.skipped.length);
      if (!shouldImport) return;

      const enriched: Song[] = [];
      const queue = [...assets];
      const workers = Array.from({ length: ID3_WORKER_COUNT }, async () => {
        while (queue.length > 0) {
          const asset = queue.shift();
          if (!asset) break;

          const fallback = parseFilename(asset.filename);
          const tags: Id3Tags = await parseId3FromUri(asset.uri).catch(() => ({}));
          const cachedCover = await cacheBase64Cover(asset.id, tags.cover);
          const cover = cachedCover ?? (tags.cover && !isBase64ImageDataUri(tags.cover) ? tags.cover : undefined);
          const extension = deriveExtension(asset.filename) ?? deriveExtension(asset.uri);
          const mimeType = deriveMimeType((asset as { mimeType?: string }).mimeType, extension);
          const size = await resolveFileSize(asset);

          enriched.push({
            id: asset.id,
            title: tags.title || fallback.title || asset.filename.replace(/\.[^.]+$/, ''),
            artist: tags.artist || fallback.artist || 'Unbekannt',
            album: tags.album,
            uri: asset.uri,
            cover,
            duration: (asset.duration ?? 0) * 1000,
            year: tags.year,
            genre: tags.genre,
            fileInfo: {
              filename: asset.filename,
              uri: asset.uri,
              extension,
              container: extension,
              mimeType,
              size,
              source: 'media-library',
              importedAt: Date.now(),
            },
            coverInfo: { status: cover ? (cachedCover ? 'cached' : 'external') : 'none', uri: cover },
          });
        }
      });

      await Promise.all(workers);
      enriched.sort((a, b) => a.title.localeCompare(b.title));
      setSongs(enriched);
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
        <View style={styles.headerRow}>
          <View style={styles.headerContent}>
            <Text style={styles.eyebrow}>KIWI</Text>
            <Text style={styles.header}>Bibliothek</Text>
            <Text style={styles.meta}>{displayedSongs.length} Titel</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.importButton, (loading || !isReady) && styles.disabled, pressed && styles.pressed]}
            onPress={importFromDevice}
            disabled={loading || !isReady}
          >
            {loading ? (
              <ActivityIndicator color={theme.palette.text.onPrimary} />
            ) : songs.length > 0 ? (
              <RefreshCcw color={theme.palette.text.onPrimary} size={18} />
            ) : (
              <Download color={theme.palette.text.onPrimary} size={18} />
            )}
            <Text style={styles.importText}>{loading ? 'Scanne…' : 'Importieren'}</Text>
          </Pressable>
        </View>


        <View style={styles.scanFoldersCard}>
          <View style={styles.scanFoldersHeader}>
            <Text style={styles.scanFoldersTitle}>Scan-Ordner</Text>
            <Pressable onPress={onAddScanFolder} style={styles.scanFoldersAddButton}>
              <Text style={styles.scanFoldersAddText}>Ordner hinzufügen</Text>
            </Pressable>
          </View>
          {scanFolders.length === 0 ? <Text style={styles.scanFoldersEmpty}>Keine Ordner ausgewählt</Text> : scanFolders.map(folder => (
            <View key={folder.id} style={styles.scanFolderRow}>
              <Pressable onPress={async () => setScanFolders(await updateScanFolder(folder.id, { enabled: !folder.enabled }))}>
                <Text style={styles.scanFolderToggle}>{folder.enabled ? '☑' : '☐'}</Text>
              </Pressable>
              <Text style={styles.scanFolderName} numberOfLines={1}>{folder.name}</Text>
              <Pressable onPress={async () => setScanFolders(await removeScanFolder(folder.id))}><Text style={styles.scanFolderRemove}>Entfernen</Text></Pressable>
            </View>
          ))}
        </View>

        {currentSong && (
          <View style={styles.previewCard}>
            <View style={styles.previewCover}>
              {currentSong.cover && !previewCoverFailed ? (
                <Image source={{ uri: currentSong.cover }} style={styles.previewCoverImage} onError={() => setPreviewCoverFailed(true)} />
              ) : (
                <Disc3 color={theme.palette.primary} size={36} />
              )}
            </View>
            <Text style={styles.previewTitle} numberOfLines={1}>{currentSong.title}</Text>
            <Text style={styles.previewMeta} numberOfLines={1}>{currentSong.artist} {isPlaying ? '· Läuft' : ''}</Text>
          </View>
        )}

        <View style={styles.searchWrap}>
          <Search color={theme.palette.text.muted} size={16} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Suche Titel, Artist, Album" placeholderTextColor={theme.palette.text.muted} style={styles.searchInput} />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          renderItem={renderItem}
          removeClippedSubviews
          windowSize={7}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          getItemLayout={getItemLayout}
          ListEmptyComponent={<Text style={styles.empty}>Keine Treffer gefunden.</Text>}
        />
      </Screen>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: theme.spacing.md, paddingTop: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md, gap: theme.spacing.md },
  headerContent: { flex: 1 },
  eyebrow: { color: theme.palette.primary, fontSize: 10, letterSpacing: 1.8, fontFamily: theme.fonts.body },
  header: { fontSize: 30, color: theme.palette.text.primary, fontFamily: theme.fonts.display },
  meta: { color: theme.palette.text.secondary, fontSize: 12, fontFamily: theme.fonts.body },
  importButton: { flexDirection: 'row', backgroundColor: theme.palette.primary, paddingVertical: 12, paddingHorizontal: theme.spacing.md, borderRadius: theme.borderRadius.pill, alignItems: 'center', gap: 8 },
  importText: { color: theme.palette.text.onPrimary, fontFamily: theme.fonts.heading, fontSize: 13 },
  previewCard: { backgroundColor: theme.palette.card, borderRadius: theme.borderRadius.lg, borderWidth: 1, borderColor: theme.palette.borderStrong, padding: theme.spacing.md, marginBottom: 12, alignItems: 'center' },
  previewCover: { width: 110, height: 110, borderRadius: 18, overflow: 'hidden', backgroundColor: theme.palette.surfaceElevated, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  previewCoverImage: { width: '100%', height: '100%' },
  previewTitle: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 16 },
  previewMeta: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 12, marginTop: 4 },
  scanFoldersCard: { backgroundColor: theme.palette.surfaceElevated, borderColor: theme.palette.border, borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 12 },
  scanFoldersHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scanFoldersTitle: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 14 },
  scanFoldersAddButton: { paddingVertical: 6, paddingHorizontal: 10, backgroundColor: theme.palette.surface, borderRadius: 8 },
  scanFoldersAddText: { color: theme.palette.primary, fontFamily: theme.fonts.body, fontSize: 12 },
  scanFoldersEmpty: { color: theme.palette.text.muted, marginTop: 6, fontFamily: theme.fonts.body },
  scanFolderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  scanFolderToggle: { color: theme.palette.text.primary, fontSize: 16 },
  scanFolderName: { flex: 1, color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 12 },
  scanFolderRemove: { color: '#f87171', fontFamily: theme.fonts.body, fontSize: 12 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.palette.surfaceElevated, borderColor: theme.palette.border, borderWidth: 1, borderRadius: theme.borderRadius.pill, paddingHorizontal: 14, marginBottom: 10, gap: 8 },
  searchInput: { flex: 1, color: theme.palette.text.primary, fontFamily: theme.fonts.body, paddingVertical: 10, fontSize: 13 },
  listContent: { paddingBottom: 120 },
  empty: { color: theme.palette.text.muted, textAlign: 'center', marginTop: 30, fontFamily: theme.fonts.body },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.85 },
});

export default Library;
