import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { theme } from '../theme';
import { Audio } from 'expo-av';

const Id3TagEditor = () => {
  const [audio, setAudio] = useState(new Audio.Sound());
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');

  useEffect(() => {
    // Load audio file
    audio.loadAsync(require('../assets/audio.mp3'));
  }, []);

  const handleSave = () => {
    // Save ID3 tags
    audio.setMetadata({
      title,
      artist,
      album,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ID3 Tag Editor</Text>
      <TextInput
        style={styles.input}
        placeholder='Title'
        value={title}
        onChangeText={(text) => setTitle(text)}
      />
      <TextInput
        style={styles.input}
        placeholder='Artist'
        value={artist}
        onChangeText={(text) => setArtist(text)}
      />
      <TextInput
        style={styles.input}
        placeholder='Album'
        value={album}
        onChangeText={(text) => setAlbum(text)}
      />
      <TouchableOpacity onPress={handleSave}>
        <Text style={styles.saveButton}>Save</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  title: {
    fontSize: 24,
    color: theme.palette.text.primary,
    padding: 16,
  },
  input: {
    height: 40,
    borderColor: theme.palette.border,
    borderWidth: 1,
    padding: 10,
    margin: 10,
  },
  saveButton: {
    fontSize: 18,
    color: theme.palette.primary,
    padding: 10,
    margin: 10,
  },
});

export default Id3TagEditor;