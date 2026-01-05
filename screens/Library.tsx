import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useMusic } from '../contexts/MusicContext';
import { theme } from '../theme';
import SongItem from '../components/SongItem';

const Library: React.FC = () => {
  const { songs, loadLibrary, playSong } = useMusic();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'title' | 'artist' | 'album'>('title');

  useEffect(() => {
    loadMusicLibrary();
  }, []);

  const loadMusicLibrary = async () => {
    setIsLoading(true);
    await loadLibrary();
    setIsLoading(false);
  };

  const filteredSongs = songs
    .filter(
      song =>
        song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        song.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (song.album && song.album.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'artist') return a.artist.localeCompare(b.artist);
      if (sortBy === 'album') return (a.album || '').localeCompare(b.album || '');
      return 0;
    });

  return (
    <LinearGradient colors={['#1a1a2e', '#0f0f1e']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bibliothek</Text>
        <Text style={styles.subtitle}>{songs.length} Songs</Text>
      </View>

      <BlurView intensity={20} style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.palette.text.secondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Suchen..."
          placeholderTextColor={theme.palette.text.secondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </BlurView>

      <View style={styles.sortContainer}>
        {(['title', 'artist', 'album'] as const).map(sort => (
          <TouchableOpacity
            key={sort}
            style={[
              styles.sortButton,
              sortBy === sort && styles.sortButtonActive,
            ]}
            onPress={() => setSortBy(sort)}
          >
            <Text
              style={[
                styles.sortText,
                sortBy === sort && styles.sortTextActive,
              ]}
            >
              {sort === 'title' ? 'Titel' : sort === 'artist' ? 'Künstler' : 'Album'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.palette.primary} />
          <Text style={styles.loadingText}>Lade Musikbibliothek...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredSongs}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => (
            <SongItem song={item} onPress={() => playSong(item)} />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.palette.text.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: theme.palette.text.secondary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: theme.palette.text.primary,
  },
  sortContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  sortButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  sortButtonActive: {
    backgroundColor: theme.palette.primary,
  },
  sortText: {
    fontSize: 14,
    color: theme.palette.text.secondary,
  },
  sortTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.palette.text.secondary,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
});

export default Library;
