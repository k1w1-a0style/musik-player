import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../theme';

interface ControlsProps { playing: boolean; onPause: () => void; onStop: () => void; }

const Controls: React.FC<ControlsProps> = ({ playing, onPause, onStop }) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onPause} style={styles.button}>
        <Text style={styles.playPauseButton}>{playing ? 'Pause' : 'Play'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onStop} style={styles.button}>
        <Text style={styles.stopButton}>Stop</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.palette.card,
    borderRadius: theme.borderRadius.sm,
    marginVertical: theme.spacing.md,
  },
  button: {
    padding: theme.spacing.sm,
  },
  playPauseButton: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.palette.primary,
  },
  stopButton: {
    fontSize: 16,
    color: theme.palette.error,
  },
});

export default Controls;