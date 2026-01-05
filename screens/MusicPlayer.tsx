import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Dimensions } from 'react-native';
import { Audio } from 'expo-av';
import { theme } from '../theme';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Permissions from 'expo-permissions';

const { width } = Dimensions.get('window');

type Song = {
  uri: string;
  filename: string;
  duration?: number;
};

const MusicPlayer: React.FC = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    requestPermissions();
    loadSongs();
  }, []);

  const requestPermissions = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      console.error('Permission to read media library not granted');
    }
  };

  const loadSongs = async () => {
    try {
      const { assets } = await MediaLibrary.getAssetsAsync({
        mediaType: 'audio',
        first: 1000 // Limit to first 1000 songs
      });

      const audioSongs: Song[] = assets.map(asset => ({
        uri: asset.uri,
        filename: asset.filename,
        duration: asset.duration
      }));

      setSongs(audioSongs);
    } catch (error) {
      console.error('Error loading songs:', error);
    }
  };

  const playSong = async (song: Song) => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: song.uri },
        { shouldPlay: true }
      );

      soundRef.current = sound;
      setCurrentSong(song);
      setIsPlaying(true);
    } catch (error) {
      console.error('Error playing song:', error);
    }
  };

  const togglePlayPause = async () => {
    if (!soundRef.current) return;

    if (isPlaying) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
    } else {
      await soundRef.current.playAsync();
      setIsPlaying(true);
    }
  };

  const renderSongItem = ({ item }: { item: Song }) => (
    <TouchableOpacity 
      style={styles.songItem} 
      onPress={() => playSong(item)}
    >
      <Text style={styles.songTitle}>{item.filename}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Meine Musikbibliothek</Text>
      
      {currentSong && (
        <View style={styles.nowPlaying}>
          <Text style={styles.nowPlayingText}>
            Aktuell: {currentSong.filename}
          </Text>
          <TouchableOpacity onPress={togglePlayPause}>
            <Text>{isPlaying ? 'Pause' : 'Play'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={songs}
        renderItem={renderSongItem}
        keyExtractor={(item, index) => index.toString()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.palette.background,
    padding: theme.spacing.md
  },
  title: {
    fontSize: 24,
    color: theme.palette.text.primary,
    marginBottom: theme.spacing.lg
  },
  songItem: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border
  },
  songTitle: {
    color: theme.palette.text.primary
  },
  nowPlaying: {
    backgroundColor: theme.palette.card,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md
  },
  nowPlayingText: {
    color: theme.palette.text.primary
  }
});

export default MusicPlayer;