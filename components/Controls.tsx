import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../theme';

const Controls = ({ playing, onPause, onStop }) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onPause}>
        <Text style={styles.playPauseButton}>{playing ? 'Pause' : 'Play'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onStop}>
        <Text style={styles.stopButton}>Stop</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: theme.spacing.md,
    backgroundColor: theme.palette.card,
    borderRadius: theme.borderRadius.sm,
  },
  playPauseButton: {
    fontSize: 18,
    color: theme.palette.primary,
  },
  stopButton: {
    fontSize: 18,
    color: theme.palette.error,
  },
});

export default Controls;
