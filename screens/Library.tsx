import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { getInfoAsync } from 'expo-file-system/legacy';
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
import { scanAudioAssetsFromMediaLibrary } from '../utils/mediaLibraryImport';
import type { AppStackParamList } from '../types/navigation';
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
  const renderCountRef = useRef(0);

  useEffect(() => {
    setPreviewCoverFailed(false);
  }, [currentSong?.id, currentSong?.cover]);

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

  const importFromDevice = async (): Promise<void> => {
    try {
      setLoading(true);
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
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.palette.surfaceElevated, borderColor: theme.palette.border, borderWidth: 1, borderRadius: theme.borderRadius.pill, paddingHorizontal: 14, marginBottom: 10, gap: 8 },
  searchInput: { flex: 1, color: theme.palette.text.primary, fontFamily: theme.fonts.body, paddingVertical: 10, fontSize: 13 },
  listContent: { paddingBottom: 120 },
  empty: { color: theme.palette.text.muted, textAlign: 'center', marginTop: 30, fontFamily: theme.fonts.body },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.85 },
});

export default Library;
