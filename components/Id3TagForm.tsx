import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { theme } from '../theme';

interface Id3TagFormProps {
  onSave: (tags: { title?: string; artist?: string; album?: string }) => void;
  initialTags?: { title?: string; artist?: string; album?: string };
}

const Id3TagForm: React.FC<Id3TagFormProps> = ({ onSave, initialTags }) => {
  const [title, setTitle] = useState(initialTags?.title || '');
  const [artist, setArtist] = useState(initialTags?.artist || '');
  const [album, setAlbum] = useState(initialTags?.album || '');

  const handleSave = () => {
    onSave({ title, artist, album });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Titel:</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Titel eingeben"
      />

      <Text style={styles.label}>Künstler:</Text>
      <TextInput
        style={styles.input}
        value={artist}
        onChangeText={setArtist}
        placeholder="Künstler eingeben"
      />

      <Text style={styles.label}>Album:</Text>
      <TextInput
        style={styles.input}
        value={album}
        onChangeText={setAlbum}
        placeholder="Album eingeben"
      />

      <View style={styles.buttonContainer}>
        <Button title="Speichern" onPress={handleSave} color={theme.palette.primary} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.md,
    backgroundColor: theme.palette.card,
    borderRadius: theme.borderRadius.md,
    marginVertical: theme.spacing.sm,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: theme.spacing.xs,
    color: theme.palette.text.primary,
  },
  input: {
    backgroundColor: theme.palette.background,
    color: theme.palette.text.primary,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  buttonContainer: {
    marginTop: theme.spacing.md,
  },
});

export default Id3TagForm;
