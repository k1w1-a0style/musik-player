import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView } from 'react-native';
import { theme } from '../theme';
import type { Song } from '../src/types/Song';

interface Id3TagFormProps {
  song: Song | null;
  onSave: (id: string, tags: Partial<Song['id3Tags']>) => void;
}

const Id3TagForm: React.FC<Id3TagFormProps> = ({ song, onSave }) => {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [year, setYear] = useState('');
  const [genre, setGenre] = useState('');

  useEffect(() => {
    if (song && song.id3Tags) {
      setTitle(song.id3Tags.title || '');
      setArtist(song.id3Tags.artist || '');
      setAlbum(song.id3Tags.album || '');
      setYear(song.id3Tags.year?.toString() || '');
      setGenre(song.id3Tags.genre || '');
    } else {
      setTitle('');
      setArtist('');
      setAlbum('');
      setYear('');
      setGenre('');
    }
  }, [song]);

  const handleSave = () => {
    if (!song) return;
    const updatedTags: Partial<Song['id3Tags']> = {
      title: title,
      artist: artist,
      album: album,
      year: parseInt(year, 10) || undefined,
      genre: genre,
    };
    onSave(song.id, updatedTags);
  };

  if (!song) {
    return (
      <View style={styles.container}>
        <Text style={styles.noSongText}>Kein Song ausgewählt</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>ID3 Tags bearbeiten</Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Titel:</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Titel eingeben"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Künstler:</Text>
        <TextInput
          style={styles.input}
          value={artist}
          onChangeText={setArtist}
          placeholder="Künstler eingeben"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Album:</Text>
        <TextInput
          style={styles.input}
          value={album}
          onChangeText={setAlbum}
          placeholder="Album eingeben"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Jahr:</Text>
        <TextInput
          style={styles.input}
          value={year}
          onChangeText={setYear}
          placeholder="Jahr eingeben"
          keyboardType="numeric"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Genre:</Text>
        <TextInput
          style={styles.input}
          value={genre}
          onChangeText={setGenre}
          placeholder="Genre eingeben"
        />
      </View>

      <View style={styles.buttonContainer}>
        <Button title="Speichern" onPress={handleSave} color={theme.palette.primary} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.md,
    backgroundColor: theme.palette.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: theme.spacing.lg,
    color: theme.palette.text.primary,
    textAlign: 'center',
  },
  noSongText: {
    fontSize: 18,
    color: theme.palette.text.secondary,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
  },
  formGroup: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: 16,
    marginBottom: theme.spacing.sm,
    color: theme.palette.text.primary,
  },
  input: {
    backgroundColor: theme.palette.card,
    color: theme.palette.text.primary,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  buttonContainer: {
    marginTop: theme.spacing.lg,
  },
});

export default Id3TagForm;
