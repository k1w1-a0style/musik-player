import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { useMusicContext } from '../contexts/MusicContext';
import SongCard from '../components/SongCard';
import type { Song } from '../types/Song';
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
  const { songs, setSongs, currentSong, playSong } = useMusicContext();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (songs.length === 0) {
      setSongs(DEMO_SONGS);
    }
  }, [songs.length, setSongs]);

  const importFromDevice = async () => {
    try {
      setLoading(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Berechtigung benötigt', 'Ohne Zugriff können keine Songs importiert werden.');
        return;
      }
      const assets = await MediaLibrary.getAssetsAsync({ mediaType: 'audio', first: 200 });
      const imported: Song[] = assets.assets.map(a => ({
        id: a.id,
        title: a.filename.replace(/\.[^.]+$/, ''),
        artist: 'Unbekannt',
        uri: a.uri,
        duration: (a.duration ?? 0) * 1000,
      }));
      if (imported.length === 0) {
        Alert.alert('Keine Musik gefunden', 'Auf dem Gerät wurden keine Audio-Dateien entdeckt.');
      } else {
        setSongs([...imported, ...DEMO_SONGS]);
      }
    } catch (e) {
      Alert.alert('Fehler', 'Medienbibliothek konnte nicht gelesen werden.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container} testID="library-screen">
      <Text style={styles.header}>Bibliothek</Text>
      <TouchableOpacity
        testID="import-device-button"
        accessibilityRole="button"
        style={[styles.importButton, loading && styles.disabled]}
        onPress={importFromDevice}
        disabled={loading}
      >
        <Text style={styles.importText}>
          {loading ? 'Lade...' : 'Vom Gerät importieren'}
        </Text>
      </TouchableOpacity>
      <FlatList
        data={songs}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: theme.spacing.xl }}
        renderItem={({ item }) => (
          <SongCard
            song={item}
            isCurrent={currentSong?.id === item.id}
            onPress={() => playSong(item)}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Keine Titel – drücke „Vom Gerät importieren".</Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.palette.background,
    padding: theme.spacing.md,
  },
  header: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.palette.text.primary,
    marginBottom: theme.spacing.md,
  },
  importButton: {
    backgroundColor: theme.palette.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.pill,
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  importText: { color: theme.palette.text.onPrimary, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  empty: {
    color: theme.palette.text.secondary,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
  },
});

export default Library;
