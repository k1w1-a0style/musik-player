import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../theme';

const SongCard = ({ song, onPress }) => {
  return (
    <TouchableOpacity onPress={onPress}>
      <View style={styles.container}>
        <Text style={styles.title}>{song.title}</Text>
        <Text style={styles.artist}>{song.artist}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  title: {
    fontSize: 18,
    color: theme.palette.text.primary,
  },
  artist: {
    fontSize: 16,
    color: theme.palette.text.secondary,
  },
});

export default SongCard;
