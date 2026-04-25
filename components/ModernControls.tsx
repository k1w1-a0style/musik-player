import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { Volume2, VolumeX } from 'lucide-react-native';
import { theme } from '../theme';

interface Props {
  volume: number;
  onVolumeChange: (v: number) => void;
}

const ModernControls: React.FC<Props> = ({ volume, onVolumeChange }) => {
  return (
    <View style={styles.container} testID="modern-controls">
      <View style={styles.row}>
        {volume <= 0.01 ? (
          <VolumeX color={theme.palette.text.muted} size={18} />
        ) : (
          <Volume2 color={theme.palette.primary} size={18} />
        )}
        <Slider
          testID="volume-slider"
          accessibilityLabel="Lautstärke"
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: theme.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  slider: { flex: 1, height: 40 },
  value: {
    color: theme.palette.text.secondary,
    fontSize: 11,
    minWidth: 40,
    textAlign: 'right',
    fontFamily: theme.fonts.mono,
  },
});

export default ModernControls;
