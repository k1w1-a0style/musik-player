import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Audio } from 'expo-av';
import { theme } from '../theme';
import SongCard from '../components/SongCard';
import Controls from '../components/Controls';

const MusicPlayer = () => {
  const [audio, setAudio] = useState(new Audio.Sound());
  const [songs, setSongs] = useState([
    { id: 1, title: 'Song 1', artist: 'Artist 1', uri: 'https://example.com/song1.mp3' },
    { id: 2, title: 'Song 2', artist: 'Artist 2', uri: 'https://example.com/song2.mp3' },
    { id: 3, title: 'Song 3', artist: 'Artist 3', uri: 'https://example.com/song3.mp3' },
  ]);
  const [currentSong, setCurrentSong] = useState(null);
  const [playing, setPlaying] = useState(false);

  const playSong = async (song) => {
    await audio.unloadAsync();
    await audio.loadAsync({ uri: song.uri });
    await audio.playAsync();
    setPlaying(true);
    setCurrentSong(song);
  };

  const pauseSong = async () => {
    await audio.pauseAsync();
    setPlaying(false);
  };

  const stopSong = async () => {
    await audio.stopAsync();
    setPlaying(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Musikplayer</Text>
      <FlatList
        data={songs}
        renderItem={({ item }) => (
          <SongCard song={item} onPress={() => playSong(item)} />
        )}
        keyExtractor={(item) => item.id.toString()}
      />
      <Controls playing={playing} onPause={pauseSong} onStop={stopSong} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.palette.background,
    padding: theme.spacing.md,
  },
  title: {
    fontSize: 24,
    color: theme.palette.text.primary,
    marginBottom: theme.spacing.md,
  },
});

export default MusicPlayer;
