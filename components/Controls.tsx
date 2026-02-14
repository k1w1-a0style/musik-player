import React from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useMusicContext } from '../src/contexts/MusicContext';

const Controls: React.FC = () => {
  const {
    isPlaying,
    isLoading,
    togglePlayPause,
    playNext,
    playPrev,
    shuffle,
    repeatMode,
    setRepeatMode,
  } = useMusicContext();

  const handleRepeatPress = () => {
    const modes: Array<'off' | 'one' | 'all'> = ['off', 'one', 'all'];
    const currentIndex = modes.indexOf(repeatMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setRepeatMode(nextMode);
  };

  const getRepeatIcon = () => {
    if (repeatMode === 'one') return 'repeat-outline';
    if (repeatMode === 'all') return 'repeat';
    return 'repeat-outline';
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={shuffle} style={styles.button}>
        <Ionicons name="shuffle" size={24} color={theme.palette.text.secondary} />
      </TouchableOpacity>

      <TouchableOpacity onPress={playPrev} style={styles.button}>
        <Ionicons name="play-skip-back" size={32} color={theme.palette.text.primary} />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={togglePlayPause}
        style={[styles.button, styles.playButton]}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="large" color={theme.palette.primary} />
        ) : (
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={40}
            color={theme.palette.primary}
          />
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={playNext} style={styles.button}>
        <Ionicons name="play-skip-forward" size={32} color={theme.palette.text.primary} />
      </TouchableOpacity>

      <TouchableOpacity onPress={handleRepeatPress} style={styles.button}>
        <Ionicons
          name={getRepeatIcon()}
          size={24}
          color={repeatMode !== 'off' ? theme.palette.primary : theme.palette.text.secondary}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.palette.card,
    borderRadius: theme.borderRadius.lg,
    marginVertical: theme.spacing.md,
  },
  button: {
    padding: theme.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: theme.palette.background,
    borderWidth: 2,
    borderColor: theme.palette.primary,
  },
});

export default Controls;
