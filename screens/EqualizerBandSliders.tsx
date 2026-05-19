import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { EQ_BAND_LABELS } from '../types/Song';
import { theme } from '../theme';

interface EqualizerBandSlidersProps {
  eqEnabled: boolean;
  eqBands: number[];
  onChangeBand: (index: number, value: number) => void;
}

const EqualizerBandSliders: React.FC<EqualizerBandSlidersProps> = ({
  eqEnabled,
  eqBands,
  onChangeBand,
}) => (
  <View style={styles.bandsRow}>
    {EQ_BAND_LABELS.map((label, i) => {
      const value = eqBands[i] ?? 0;

      return (
        <View key={label} style={styles.bandCol}>
          <Text style={styles.bandValue}>{value > 0 ? '+' : ''}{value.toFixed(0)}</Text>
          <Slider
            style={styles.verticalSlider}
            minimumValue={-12}
            maximumValue={12}
            step={1}
            value={value}
            onValueChange={nextValue => onChangeBand(i, nextValue)}
            disabled={!eqEnabled}
            minimumTrackTintColor={theme.palette.primary}
            maximumTrackTintColor={theme.palette.border}
            thumbTintColor={theme.palette.primary}
          />
          <Text style={styles.bandLabel}>{label}</Text>
        </View>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  bandsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: theme.spacing.lg, height: 240 },
  bandCol: { flex: 1, alignItems: 'center' },
  verticalSlider: { width: 120, height: 40, transform: [{ rotate: '-90deg' }], marginVertical: theme.spacing.xl },
  bandValue: { color: theme.palette.text.secondary, fontSize: 10, fontFamily: theme.fonts.mono },
  bandLabel: { color: theme.palette.text.primary, fontSize: 11, marginTop: theme.spacing.sm, fontFamily: theme.fonts.body },
});

export default EqualizerBandSliders;
