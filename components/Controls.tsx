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
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
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
