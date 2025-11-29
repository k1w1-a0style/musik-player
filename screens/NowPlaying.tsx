import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { theme } from '../theme';

const NowPlaying = () => {
  return (
    <View style={styles.container}>
      <Image source={{ uri: 'https://example.com/cover.jpg' }} style={styles.cover} />
      <Text style={styles.title}>Song Title</Text>
      <Text style={styles.artist}>Artist Name</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  cover: {
    width: 200,
    height: 200,
    borderRadius: 10,
  },
  title: {
    fontSize: 24,
    color: theme.palette.text.primary,
    padding: 16,
  },
  artist: {
    fontSize: 18,
    color: theme.palette.text.secondary,
    padding: 16,
  },
});

export default NowPlaying;
