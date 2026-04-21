import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import Slider from '@react-native-community/slider';
import { theme } from '../theme';

const BANDS = ['60', '170', '310', '600', '1K', '3K', '6K', '12K', '14K', '16K'];

const Equalizer: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [values, setValues] = useState<number[]>(() => BANDS.map(() => 0));

  const setBand = (i: number, v: number) => {
    setValues(prev => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  };

  return (
    <View style={styles.container} testID="equalizer-screen">
      <View style={styles.headerRow}>
        <Text style={styles.title}>Equalizer</Text>
        <Switch
          testID="equalizer-toggle"
          value={enabled}
          onValueChange={setEnabled}
          trackColor={{ false: theme.palette.border, true: theme.palette.primary }}
          thumbColor={theme.palette.text.primary}
        />
      </View>
      <Text style={styles.hint}>
        Hinweis: Dies ist eine UI-Demo. Echte DSP-Verarbeitung erfordert ein Native-Module
        (z.B. react-native-audio-api).
      </Text>
      <View style={styles.bandsRow}>
        {BANDS.map((label, i) => (
          <View key={label} style={styles.bandCol}>
            <Text style={styles.bandValue}>{values[i].toFixed(0)}dB</Text>
            <Slider
              testID={`eq-band-${label}`}
              style={styles.verticalSlider}
              minimumValue={-12}
              maximumValue={12}
              step={1}
              value={values[i]}
              onValueChange={v => setBand(i, v)}
              disabled={!enabled}
              minimumTrackTintColor={theme.palette.primary}
              maximumTrackTintColor={theme.palette.border}
              thumbTintColor={theme.palette.primary}
            />
            <Text style={styles.bandLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.palette.background,
    padding: theme.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  title: { fontSize: 24, fontWeight: '800', color: theme.palette.text.primary },
  hint: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginBottom: theme.spacing.lg,
  },
  bandsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    flex: 1,
  },
  bandCol: {
    flex: 1,
    alignItems: 'center',
  },
  verticalSlider: {
    width: 120,
    height: 40,
    transform: [{ rotate: '-90deg' }],
    marginVertical: theme.spacing.xl,
  },
  bandValue: { color: theme.palette.text.secondary, fontSize: 10 },
  bandLabel: { color: theme.palette.text.primary, fontSize: 12, marginTop: theme.spacing.sm },
});

export default Equalizer;
