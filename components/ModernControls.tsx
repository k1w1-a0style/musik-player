import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { theme } from '../theme';

interface Props {
  volume: number;
  onVolumeChange: (v: number) => void;
}

const ModernControls: React.FC<Props> = ({ volume, onVolumeChange }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Lautstärke</Text>
      <Slider
        testID="volume-slider"
        style={styles.slider}
        minimumValue={0}
        maximumValue={1}
        value={volume}
        onValueChange={onVolumeChange}
        minimumTrackTintColor={theme.palette.primary}
        maximumTrackTintColor={theme.palette.border}
        thumbTintColor={theme.palette.primary}
      />
      <Text style={styles.value}>{Math.round(volume * 100)}%</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  label: { color: theme.palette.text.secondary, fontSize: 12 },
  slider: { width: '100%', height: 40 },
  value: { color: theme.palette.text.primary, textAlign: 'right', fontSize: 12 },
});

export default ModernControls;
