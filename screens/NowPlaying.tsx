import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Audio } from 'expo-av';
import { theme } from '../theme';

const NowPlaying = () => {
  const [audio, setAudio] = useState(new Audio.Sound());
  const [songs, setSongs] = useState([
    { id: 1, title: 'Song 1', artist: 'Artist 1', uri: 'https://example.com/song1.mp3' },
    { id: 2, title: 'Song 2', artist: 'Artist 2', uri: 'https://example.com/song2.mp3' },
    { id: 3, title: 'Song 3', artist: 'Artist 3', uri: 'https://example.com/song3.mp3' }
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
      <Text style={styles.title}>Now Playing</Text>
      <FlatList
        data={songs}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={styles.itemArtist}>{item.artist}</Text>
          </View>
        )}
        keyExtractor={(item) => item.id.toString()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0'
  },
  title: {
    fontSize: 24,
    marginBottom: 16
  },
  item: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc'
  },
  itemTitle: {
    fontSize: 18,
    marginBottom: 8
  },
  itemArtist: {
    fontSize: 14,
    color: '#666'
  }
});

export default NowPlaying;