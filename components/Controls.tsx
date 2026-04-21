import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useMusicContext } from '../contexts/MusicContext';
import { theme } from '../theme';

const Controls: React.FC = () => {
  const { isPlaying, togglePlayPause, next, previous, currentSong } = useMusicContext();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        testID="controls-previous"
        accessibilityRole="button"
        accessibilityLabel="Vorheriger Titel"
        onPress={previous}
        style={styles.button}
      >
        <Text style={styles.icon}>⏮</Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID="controls-play-pause"
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause' : 'Abspielen'}
        onPress={togglePlayPause}
        disabled={!currentSong}
        style={[styles.button, styles.playButton, !currentSong && styles.disabled]}
      >
        <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID="controls-next"
        accessibilityRole="button"
        accessibilityLabel="Nächster Titel"
        onPress={next}
        style={styles.button}
      >
        <Text style={styles.icon}>⏭</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: theme.borderRadius.pill,
    backgroundColor: theme.palette.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  playButton: {
    width: 72,
    height: 72,
    backgroundColor: theme.palette.primary,
    borderColor: theme.palette.primaryDark,
  },
  disabled: { opacity: 0.4 },
  icon: { color: theme.palette.text.primary, fontSize: 22 },
  playIcon: { color: theme.palette.text.onPrimary, fontSize: 28, fontWeight: '700' },
});

export default Controls;
