import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Song } from '../src/types/Song';

const Id3TagForm: React.FC<{ song: Song }> = ({ song }) => {
  return (
    <View style={styles.container}>
      <TextInput placeholder='Title' value={song.title} />
      <TextInput placeholder='Artist' value={song.artist} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
});

export default Id3TagForm;
