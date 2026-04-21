import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useMusicContext } from '../contexts/MusicContext';
import Controls from '../components/Controls';
import ProgressBar from '../components/ProgressBar';
import { theme } from '../theme';

const NowPlaying: React.FC = () => {
  const { currentSong, position, duration, seekTo } = useMusicContext();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.artwork} testID="now-playing-artwork">
        <Text style={styles.artworkPlaceholder}>♫</Text>
      </View>
      <Text style={styles.title} numberOfLines={2} testID="now-playing-title">
        {currentSong?.title ?? 'Kein Titel ausgewählt'}
      </Text>
      <Text style={styles.artist} numberOfLines={1} testID="now-playing-artist">
        {currentSong?.artist ?? 'Wähle einen Song aus der Bibliothek'}
      </Text>
      <ProgressBar currentPosition={position} duration={duration} onSeek={seekTo} />
      <Controls />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.palette.background },
  content: { padding: theme.spacing.lg, alignItems: 'center' },
  artwork: {
    width: 260,
    height: 260,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: theme.spacing.xl,
  },
  artworkPlaceholder: { color: theme.palette.primary, fontSize: 96 },
  title: {
    color: theme.palette.text.primary,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  artist: {
    color: theme.palette.text.secondary,
    fontSize: 14,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
});

export default NowPlaying;
