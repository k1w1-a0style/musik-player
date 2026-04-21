import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import type { Song } from '../types/Song';
import { theme } from '../theme';

interface Props {
  initial?: Partial<Song>;
  onSubmit: (song: Song) => void;
}

const Id3TagForm: React.FC<Props> = ({ initial, onSubmit }) => {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [artist, setArtist] = useState(initial?.artist ?? '');
  const [album, setAlbum] = useState(initial?.album ?? '');

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit({
      id: initial?.id ?? Date.now().toString(),
      title: title.trim(),
      artist: artist.trim(),
      album: album.trim() || undefined,
      uri: initial?.uri,
      cover: initial?.cover,
      duration: initial?.duration,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Titel</Text>
      <TextInput
        testID="id3-title"
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Songtitel"
        placeholderTextColor={theme.palette.text.secondary}
      />
      <Text style={styles.label}>Künstler</Text>
      <TextInput
        testID="id3-artist"
        style={styles.input}
        value={artist}
        onChangeText={setArtist}
        placeholder="Künstlername"
        placeholderTextColor={theme.palette.text.secondary}
      />
      <Text style={styles.label}>Album</Text>
      <TextInput
        testID="id3-album"
        style={styles.input}
        value={album}
        onChangeText={setAlbum}
        placeholder="Album"
        placeholderTextColor={theme.palette.text.secondary}
      />
      <TouchableOpacity
        testID="id3-submit"
        accessibilityRole="button"
        onPress={handleSubmit}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Speichern</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: theme.spacing.sm },
  label: { color: theme.palette.text.secondary, fontSize: 12, marginTop: theme.spacing.sm },
  input: {
    backgroundColor: theme.palette.card,
    color: theme.palette.text.primary,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  button: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.palette.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  buttonText: { color: theme.palette.text.onPrimary, fontWeight: '700' },
});

export default Id3TagForm;
