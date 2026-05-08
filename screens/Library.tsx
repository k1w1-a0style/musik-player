import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, ActivityIndicator, TextInput, Image } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { Download, RefreshCcw, Search, Disc3 } from 'lucide-react-native';
import { useMusicContext } from '../contexts/MusicContext';
import SongCard from '../components/SongCard';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import type { Song } from '../types/Song';
import { parseId3FromUri, type Id3Tags } from '../utils/id3Parser';
import { parseFilename } from '../utils/musicParser';
import { cacheBase64Cover } from '../utils/coverCache';
import { theme } from '../theme';
import { scanAudioAssetsFromMediaLibrary } from '../utils/mediaLibraryImport';

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

const ID3_WORKER_COUNT = 3;

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

const Library: React.FC = () => {
  const { songs, setSongs, currentSong, playSong, isReady, isPlaying } = useMusicContext();
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

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
        Alert.alert(
          'Keine Musik gefunden',
          'Es wurden keine passenden Musikdateien gefunden. Kurze Audios, Sprachnachrichten und Systemtöne werden übersprungen.',
        );
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
          const filenameTitle = asset.filename.replace(/\.[^.]+$/, '');
          const tags: Id3Tags = await parseId3FromUri(asset.uri).catch(() => ({}));
          const cover = (await cacheBase64Cover(asset.id, tags.cover)) ?? tags.cover;

          enriched.push({
            id: asset.id,
            title: tags.title || fallback.title || filenameTitle,
            artist: tags.artist || fallback.artist || 'Unbekannt',
            album: tags.album,
            uri: asset.uri,
            cover,
            duration: (asset.duration ?? 0) * 1000,
            year: tags.year,
            genre: tags.genre,
          });
        }
      });

      await Promise.all(workers);

      if (enriched.length === 0) {
        Alert.alert('Keine Musik gefunden', 'Auf dem Gerät wurden keine Audio-Dateien entdeckt.');
        return;
      }

      enriched.sort((a, b) => a.title.localeCompare(b.title));
      setSongs(enriched);
    } catch {
      Alert.alert('Fehler', 'Medienbibliothek konnte nicht gelesen werden.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppBackground>
      <Screen testID="library-screen" contentStyle={styles.container}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
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
              {currentSong.cover ? (
                <Image source={{ uri: currentSong.cover }} style={styles.previewCoverImage} />
              ) : (
                <Disc3 color={theme.palette.primary} size={36} />
              )}
            </View>
            <Text style={styles.previewTitle} numberOfLines={1}>{currentSong.title}</Text>
            <Text style={styles.previewMeta} numberOfLines={1}>
              {currentSong.artist} {isPlaying ? '· Läuft' : ''}
            </Text>
          </View>
        )}

        <View style={styles.searchWrap}>
          <Search color={theme.palette.text.muted} size={16} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Suche Titel, Artist, Album"
            placeholderTextColor={theme.palette.text.muted}
            style={styles.searchInput}
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <SongCard
              song={item}
              isCurrent={currentSong?.id === item.id}
              isPlaying={isPlaying}
              onPress={() => playSong(item)}
            />
          )}
          ListEmptyComponent={<Text style={styles.empty}>Keine Treffer gefunden.</Text>}
        />
      </Screen>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingTop: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    gap: theme.spacing.md,
  },
  eyebrow: {
    color: theme.palette.primary,
    fontSize: 10,
    letterSpacing: 1.8,
    fontFamily: theme.fonts.body,
  },
  header: {
    fontSize: 30,
    color: theme.palette.text.primary,
    fontFamily: theme.fonts.display,
  },
  meta: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontFamily: theme.fonts.body,
  },
  importButton: {
    flexDirection: 'row',
    backgroundColor: theme.palette.primary,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.pill,
    alignItems: 'center',
    gap: 8,
  },
  importText: {
    color: theme.palette.text.onPrimary,
    fontFamily: theme.fonts.heading,
    fontSize: 13,
  },
  previewCard: {
    backgroundColor: theme.palette.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.palette.borderStrong,
    padding: theme.spacing.md,
    marginBottom: 12,
    alignItems: 'center',
    ...theme.shadows.glow,
  },
  previewCover: {
    width: 110,
    height: 110,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: theme.palette.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCoverImage: { width: '100%', height: '100%' },
  previewTitle: {
    marginTop: 10,
    color: theme.palette.text.primary,
    fontFamily: theme.fonts.heading,
    fontSize: 16,
  },
  previewMeta: {
    color: theme.palette.text.secondary,
    fontFamily: theme.fonts.body,
    fontSize: 12,
  },
  searchWrap: {
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.palette.surface,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
  },
  searchInput: {
    flex: 1,
    color: theme.palette.text.primary,
    fontFamily: theme.fonts.body,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
  listContent: { paddingBottom: 180 },
  empty: {
    color: theme.palette.text.secondary,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
    fontFamily: theme.fonts.body,
  },
});

export default Library;
