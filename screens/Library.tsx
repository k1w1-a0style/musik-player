import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, ActivityIndicator } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { Download, RefreshCcw } from 'lucide-react-native';
import { useMusicContext } from '../contexts/MusicContext';
import SongCard from '../components/SongCard';
import AppBackground from '../components/AppBackground';
import type { Song } from '../types/Song';
import { parseId3FromUri } from '../utils/id3Parser';
import { parseFilename } from '../utils/musicParser';
import { theme } from '../theme';

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

const Library: React.FC = () => {
  const { songs, setSongs, currentSong, playSong, isReady } = useMusicContext();
  const [loading, setLoading] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (isReady && !seeded && songs.length === 0) {
      setSongs(DEMO_SONGS);
      setSeeded(true);
    }
    if (isReady && songs.length > 0) setSeeded(true);
  }, [isReady, seeded, songs.length, setSongs]);

  const importFromDevice = async (): Promise<void> => {
    try {
      setLoading(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Berechtigung benötigt', 'Ohne Zugriff können keine Songs importiert werden.');
        return;
      }
      const assets = await MediaLibrary.getAssetsAsync({ mediaType: 'audio', first: 200 });

      // Parse ID3 tags for each track in parallel (capped to 8 concurrent)
      const enriched: Song[] = [];
      const queue = [...assets.assets];
      const workers = Array.from({ length: 8 }, async () => {
        while (queue.length > 0) {
          const a = queue.shift();
          if (!a) break;
          const filenameTitle = a.filename.replace(/\.[^.]+$/, '');
          const fallback = parseFilename(a.filename);
          const tags = await parseId3FromUri(a.uri);
          enriched.push({
            id: a.id,
            title: tags.title || fallback.title || filenameTitle,
            artist: tags.artist || fallback.artist || 'Unbekannt',
            album: tags.album,
            uri: a.uri,
            cover: tags.cover,
            duration: (a.duration ?? 0) * 1000,
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
      // Sort by title for stable UX
      enriched.sort((a, b) => a.title.localeCompare(b.title));
      setSongs([...enriched, ...DEMO_SONGS]);
    } catch {
      Alert.alert('Fehler', 'Medienbibliothek konnte nicht gelesen werden.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppBackground>
      <View style={styles.container} testID="library-screen">
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>DEINE SAMMLUNG</Text>
            <Text style={styles.header}>Bibliothek</Text>
            <Text style={styles.meta} testID="library-meta">
              {songs.length} {songs.length === 1 ? 'Titel' : 'Titel'}
            </Text>
          </View>
          <Pressable
            testID="import-device-button"
            accessibilityRole="button"
            accessibilityLabel="Songs vom Gerät importieren"
            style={({ pressed }) => [
              styles.importButton,
              loading && styles.disabled,
              pressed && styles.pressed,
            ]}
            onPress={importFromDevice}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.palette.text.onPrimary} />
            ) : songs.length > DEMO_SONGS.length ? (
              <RefreshCcw color={theme.palette.text.onPrimary} size={18} />
            ) : (
              <Download color={theme.palette.text.onPrimary} size={18} />
            )}
            <Text style={styles.importText}>
              {loading ? 'Lese ID3…' : 'Importieren'}
            </Text>
          </Pressable>
        </View>
        <FlatList
          data={songs}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <SongCard
              song={item}
              isCurrent={currentSong?.id === item.id}
              onPress={() => playSong(item)}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.empty} testID="library-empty">
              Keine Titel – tippe auf „Importieren".
            </Text>
          }
        />
      </View>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  eyebrow: {
    color: theme.palette.primary,
    fontSize: 10,
    letterSpacing: 1.8,
    fontFamily: theme.fonts.body,
    marginBottom: 2,
  },
  header: {
    fontSize: 32,
    color: theme.palette.text.primary,
    fontFamily: theme.fonts.display,
    letterSpacing: -1.0,
  },
  meta: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginTop: 2,
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
    letterSpacing: 0.2,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
  listContent: { paddingBottom: theme.spacing.xxl },
  empty: {
    color: theme.palette.text.secondary,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
    fontFamily: theme.fonts.body,
  },
});

export default Library;
