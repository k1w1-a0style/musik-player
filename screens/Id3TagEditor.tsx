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
      <TouchableOpacity style={styles.button} onPress={handleSave}>
        <Text style={styles.buttonText}>Save</Text>
      </TouchableOpacity>
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
  input: {
    backgroundColor: theme.palette.card,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    color: theme.palette.text.primary,
  },
  button: {
    backgroundColor: theme.palette.primary,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  buttonText: {
    color: theme.palette.text.primary,
    fontSize: 18,
  },
});

export default Id3TagEditor;
