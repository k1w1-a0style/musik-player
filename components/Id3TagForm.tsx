import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Save } from 'lucide-react-native';
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

  const canSubmit = title.trim().length > 0;

  const handleSubmit = (): void => {
    if (!canSubmit) return;
    onSubmit({
      id: initial?.id ?? Date.now().toString(),
      title: title.trim(),
      artist: artist.trim(),
      album: album.trim() || undefined,
      uri: initial?.uri,
      cover: initial?.cover,
      duration: initial?.duration,
      year: initial?.year,
      genre: initial?.genre,
    });
  };

  return (
    <View style={styles.container} testID="id3-form">
      <Text style={styles.label}>Titel</Text>
      <TextInput
        testID="id3-title"
        accessibilityLabel="Songtitel"
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Songtitel"
        placeholderTextColor={theme.palette.text.muted}
      />
      <Text style={styles.label}>Künstler</Text>
      <TextInput
        testID="id3-artist"
        accessibilityLabel="Künstlername"
        style={styles.input}
        value={artist}
        onChangeText={setArtist}
        placeholder="Künstlername"
        placeholderTextColor={theme.palette.text.muted}
      />
      <Text style={styles.label}>Album</Text>
      <TextInput
        testID="id3-album"
        accessibilityLabel="Album"
        style={styles.input}
        value={album}
        onChangeText={setAlbum}
        placeholder="Album"
        placeholderTextColor={theme.palette.text.muted}
      />
      <Pressable
        testID="id3-submit"
        accessibilityRole="button"
        accessibilityLabel="Tags speichern"
        onPress={handleSubmit}
        disabled={!canSubmit}
        style={({ pressed }) => [
          styles.button,
          !canSubmit && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <Save color={theme.palette.text.onPrimary} size={18} />
        <Text style={styles.buttonText}>Speichern</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: theme.spacing.sm },
  label: {
    color: theme.palette.text.secondary,
    fontSize: 11,
    letterSpacing: 1.2,
    marginTop: theme.spacing.sm,
    fontFamily: theme.fonts.body,
  },
  input: {
    backgroundColor: theme.palette.surfaceElevated,
    color: theme.palette.text.primary,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    fontFamily: theme.fonts.body,
  },
  button: {
    flexDirection: 'row',
    marginTop: theme.spacing.md,
    backgroundColor: theme.palette.primary,
    borderRadius: theme.borderRadius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: theme.palette.text.onPrimary,
    fontFamily: theme.fonts.heading,
    fontSize: 14,
    letterSpacing: 0.2,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});

export default Id3TagForm;
