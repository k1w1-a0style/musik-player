import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { EQ_BAND_LABELS } from '../types/Song';
import { APP_THEME_TOKENS } from '../utils/appTheme';
import { useAppTheme } from '../contexts/AppThemeContext';

const toA11yHz = (label: string): string =>
  label.endsWith('K') ? `${label.slice(0, -1)} kHz` : `${label} Hz`;

interface EqualizerBandSlidersProps {
  eqEnabled: boolean;
  eqBands: number[];
  onChangeBand: (index: number, value: number) => void;
}

const EqualizerBandSliders: React.FC<EqualizerBandSlidersProps> = ({
  eqEnabled,
  eqBands,
  onChangeBand,
}) => {
  const { theme } = useAppTheme();

  return (
    <View style={styles.bandsRow}>
      {EQ_BAND_LABELS.map((label, i) => {
        const value = eqBands[i] ?? 0;

        return (
          <View key={label} style={styles.bandCol}>
            <Text style={[styles.bandValue, { color: theme.palette.text.secondary }]}>{value > 0 ? '+' : ''}{value.toFixed(0)}</Text>
            <Slider
              style={styles.verticalSlider}
              minimumValue={-12}
              maximumValue={12}
              step={1}
              value={value}
              onValueChange={nextValue => onChangeBand(i, nextValue)}
              accessibilityLabel={`EQ-Band ${toA11yHz(label)}`}
              accessibilityState={{ disabled: !eqEnabled }}
              disabled={!eqEnabled}
              minimumTrackTintColor={theme.palette.primary}
              maximumTrackTintColor={theme.palette.border}
              thumbTintColor={theme.palette.primary}
            />
            <Text style={[styles.bandLabel, { color: theme.palette.text.primary }]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bandsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: APP_THEME_TOKENS.spacing.lg, height: 240 },
  bandCol: { flex: 1, alignItems: 'center' },
  verticalSlider: { width: 120, height: 40, transform: [{ rotate: '-90deg' }], marginVertical: APP_THEME_TOKENS.spacing.xl },
  bandValue: { fontSize: 10, fontFamily: (Platform.OS === 'android' ? 'monospace' : 'Menlo') },
  bandLabel: { fontSize: 11, marginTop: APP_THEME_TOKENS.spacing.sm, fontFamily: APP_THEME_TOKENS.fonts.body },
});

export default EqualizerBandSliders;
