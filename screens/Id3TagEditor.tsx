import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useMusicContext } from '../contexts/MusicContext';
import Id3TagForm from '../components/Id3TagForm';
import type { Song } from '../types/Song';
import { theme } from '../theme';

const Id3TagEditor: React.FC = () => {
  const { currentSong, songs, setSongs } = useMusicContext();

  const handleSave = (updated: Song) => {
    if (!currentSong) return;
    const next = songs.map(s => (s.id === currentSong.id ? { ...s, ...updated, id: s.id } : s));
    setSongs(next);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>ID3 Tags bearbeiten</Text>
      {currentSong ? (
        <Id3TagForm
          key={currentSong.id}
          initial={currentSong}
          onSubmit={handleSave}
        />
      ) : (
        <Text style={styles.placeholderText}>
          Wähle zuerst einen Song in der Bibliothek aus, um seine Tags zu bearbeiten.
        </Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.palette.background },
  content: { padding: theme.spacing.md },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.palette.text.primary,
    marginBottom: theme.spacing.lg,
  },
  placeholderText: {
    fontSize: 14,
    color: theme.palette.text.secondary,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
  },
});

export default Id3TagEditor;
