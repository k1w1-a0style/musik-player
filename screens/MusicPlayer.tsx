import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { theme } from '../theme';
import Controls from '../components/Controls';

interface Song { id: number; title: string; artist: string; uri: string; duration?: number; }

const MusicPlayer: React.FC = () => {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [playing, setPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const fetchSongs = async () => {
      try {
        const response = await fetch('https://api.example.com/songs');
        const data = await response.json();
        setSongs(data);
      } catch (error) {
        console.error('Fehler beim Abrufen der Songs:', error);
      }
    }
    fetchSongs();
  }, []);

  const loadAndPlay = async (song: Song) => {
    if (!song) return;
    setIsLoading(true);
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const { sound, status } = await Audio.Sound.createAsync(
        { uri: song.uri },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );
      soundRef.current = sound;
      setPlaying(true);
      setDuration(song.duration || 0);
      setCurrentTime(0);
    } catch (error) {
      console.error('Fehler beim Laden und Abspielen:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const onPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      soundRef.current?.setVolume(0.5);
      soundRef.current?.setPositionAsync(0);
      soundRef.current?.playAsync();
    }
  }

  const handleNextSong = () => {
    setIndex((prevIndex) => (prevIndex + 1) % songs.length);
    setCurrentSong(songs[index]);
    loadAndPlay(songs[index]);
  }

  const handlePreviousSong = () => {
    setIndex((prevIndex) => (prevIndex - 1 + songs.length) % songs.length);
    setCurrentSong(songs[index]);
    loadAndPlay(songs[index]);
  }

  const handlePause = () => {
    if (soundRef.current) {
      soundRef.current.pauseAsync();
      setPlaying(false);
    }
  }

  const handleStop = () => {
    if (soundRef.current) {
      soundRef.current.stopAsync();
      setPlaying(false);
      setCurrentTime(0);
    }
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={songs}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => loadAndPlay(item)} style={styles.songItem}>
            <Text style={styles.songText}>{item.title}</Text>
          </TouchableOpacity>
        )}
      />
      <Controls
        playing={playing}
        onPause={handlePause}
        onStop={handleStop}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.palette.background,
    padding: theme.spacing.md,
  },
  songItem: {
    padding: theme.spacing.sm,
    backgroundColor: theme.palette.card,
    borderRadius: theme.borderRadius.md,
    marginVertical: theme.spacing.sm,
  },
  songText: {
    fontSize: 18,
    color: theme.palette.text.primary,
  }
});
