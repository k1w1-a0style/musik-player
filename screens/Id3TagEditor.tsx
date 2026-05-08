import React from 'react';
import { Text, StyleSheet, ScrollView, View } from 'react-native';
import { useMusicContext } from '../contexts/MusicContext';
import Id3TagForm from '../components/Id3TagForm';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import GlassCard from '../components/GlassCard';
import type { Song } from '../types/Song';
import { theme } from '../theme';

const Id3TagEditor: React.FC = () => {
  const { currentSong, songs, setSongs } = useMusicContext();

  const handleSave = (updated: Song): void => {
    if (!currentSong) return;
    const next = songs.map(s =>
      s.id === currentSong.id ? { ...s, ...updated, id: s.id, uri: s.uri } : s,
    );
    setSongs(next);
  };

  return (
    <AppBackground>
      <Screen style={styles.container} contentStyle={styles.content}><ScrollView>
        <Text style={styles.eyebrow}>METADATEN</Text>
        <Text style={styles.title}>ID3 Tags bearbeiten</Text>
        {currentSong ? (
          <GlassCard style={styles.card}>
            <Id3TagForm key={currentSong.id} initial={currentSong} onSubmit={handleSave} />
          </GlassCard>
        ) : (
          <View style={styles.placeholder} testID="id3-empty">
            <Text style={styles.placeholderText}>
              Wähle zuerst einen Song in der Bibliothek aus, um seine Tags zu bearbeiten.
            </Text>
          </View>
        )}
      </ScrollView></Screen>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: 8,
    paddingBottom: theme.spacing.xxl,
  },
  eyebrow: {
    color: theme.palette.primary,
    fontSize: 10,
    letterSpacing: 1.8,
    fontFamily: theme.fonts.body,
  },
  title: {
    fontSize: 28,
    fontFamily: theme.fonts.display,
    letterSpacing: -0.6,
    color: theme.palette.text.primary,
    marginBottom: theme.spacing.lg,
  },
  card: { marginBottom: theme.spacing.md },
  placeholder: { paddingVertical: theme.spacing.xxl },
  placeholderText: {
    fontSize: 14,
    color: theme.palette.text.secondary,
    textAlign: 'center',
    fontFamily: theme.fonts.body,
    lineHeight: 22,
  },
});

export default Id3TagEditor;
