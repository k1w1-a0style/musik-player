import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, Pressable } from 'react-native';
import Slider from '@react-native-community/slider';
import { useMusicContext } from '../contexts/MusicContext';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import { EQ_BAND_LABELS } from '../types/Song';
import { theme } from '../theme';
import EqualizerCurveChart from './EqualizerCurveChart';
import EqualizerStatusCard from './EqualizerStatusCard';
import {
  buildEqualizerCurvePath,
  PRESET_KEYS,
  PRESET_LABELS,
} from './equalizerHelpers';

const Equalizer: React.FC = () => {
  const { eqEnabled, setEqEnabled, eqBands, setEqBand, eqPreset, applyEqPreset, eqNative } = useMusicContext();

  const curvePath = useMemo(() => buildEqualizerCurvePath(eqBands), [eqBands]);

  return (
    <AppBackground>
      <Screen style={styles.container} testID="equalizer-screen" contentStyle={styles.content}><ScrollView>
        <Text style={styles.eyebrow}>SOUND</Text>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Equalizer</Text>
          <Switch value={eqEnabled} onValueChange={setEqEnabled} trackColor={{ false: theme.palette.border, true: theme.palette.primary }} thumbColor={theme.palette.text.primary} />
        </View>

        <EqualizerStatusCard eqNative={eqNative} />
        <EqualizerCurveChart curvePath={curvePath} />

        <Text style={styles.sectionTitle}>Presets</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
          {PRESET_KEYS.map(key => {
            const active = eqPreset === key;
            return (
              <Pressable key={key} onPress={() => applyEqPreset(key)} style={({ pressed }) => [styles.preset, active && styles.presetActive, pressed && styles.pressed]}>
                <Text style={[styles.presetText, active && styles.presetTextActive]}>{PRESET_LABELS[key]}</Text>
              </Pressable>
            );
          })}
          {eqPreset === 'custom' && <View style={[styles.preset, styles.presetActive]}><Text style={[styles.presetText, styles.presetTextActive]}>Custom</Text></View>}
        </ScrollView>

        <View style={styles.bandsRow}>
          {EQ_BAND_LABELS.map((label, i) => (
            <View key={label} style={styles.bandCol}>
              <Text style={styles.bandValue}>{(eqBands[i] ?? 0) > 0 ? '+' : ''}{(eqBands[i] ?? 0).toFixed(0)}</Text>
              <Slider style={styles.verticalSlider} minimumValue={-12} maximumValue={12} step={1} value={eqBands[i] ?? 0} onValueChange={v => setEqBand(i, v)} disabled={!eqEnabled} minimumTrackTintColor={theme.palette.primary} maximumTrackTintColor={theme.palette.border} thumbTintColor={theme.palette.primary} />
              <Text style={styles.bandLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </ScrollView></Screen>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: theme.spacing.md, paddingTop: 8 },
  eyebrow: { color: theme.palette.primary, fontSize: 10, letterSpacing: 1.8, fontFamily: theme.fonts.body },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md },
  title: { fontSize: 32, fontFamily: theme.fonts.display, letterSpacing: -1, color: theme.palette.text.primary },
  sectionTitle: { color: theme.palette.text.muted, fontSize: 11, letterSpacing: 1.6, fontFamily: theme.fonts.body, marginBottom: theme.spacing.sm },
  presetRow: { flexDirection: 'row', gap: theme.spacing.sm, paddingVertical: theme.spacing.xs, paddingRight: theme.spacing.md },
  preset: { paddingHorizontal: theme.spacing.md, paddingVertical: 10, borderRadius: theme.borderRadius.pill, backgroundColor: theme.palette.surface, borderWidth: 1, borderColor: theme.palette.border },
  presetActive: { backgroundColor: theme.palette.primary, borderColor: theme.palette.primaryDark },
  presetText: { color: theme.palette.text.secondary, fontFamily: theme.fonts.heading, fontSize: 12, letterSpacing: 0.4 },
  presetTextActive: { color: theme.palette.text.onPrimary },
  pressed: { opacity: 0.75 },
  bandsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: theme.spacing.lg, height: 240 },
  bandCol: { flex: 1, alignItems: 'center' },
  verticalSlider: { width: 120, height: 40, transform: [{ rotate: '-90deg' }], marginVertical: theme.spacing.xl },
  bandValue: { color: theme.palette.text.secondary, fontSize: 10, fontFamily: theme.fonts.mono },
  bandLabel: { color: theme.palette.text.primary, fontSize: 11, marginTop: theme.spacing.sm, fontFamily: theme.fonts.body },
});

export default Equalizer;
