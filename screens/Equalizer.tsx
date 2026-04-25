import React from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, Pressable } from 'react-native';
import Slider from '@react-native-community/slider';
import { useMusicContext } from '../contexts/MusicContext';
import AppBackground from '../components/AppBackground';
import GlassCard from '../components/GlassCard';
import { EQ_BAND_LABELS, EQ_PRESETS, type EqPresetName } from '../types/Song';
import { theme } from '../theme';

const PRESET_LABELS: Record<EqPresetName, string> = {
  flat: 'Flat',
  rock: 'Rock',
  pop: 'Pop',
  jazz: 'Jazz',
  bassBoost: 'Bass+',
  vocal: 'Vocal',
  electronic: 'Electronic',
};

const PRESET_KEYS = Object.keys(EQ_PRESETS) as EqPresetName[];

const formatHz = (hz: number): string => (hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${hz}`);

const Equalizer: React.FC = () => {
  const { eqEnabled, setEqEnabled, eqBands, setEqBand, eqPreset, applyEqPreset, eqNative } =
    useMusicContext();

  return (
    <AppBackground>
      <ScrollView style={styles.container} testID="equalizer-screen">
        <Text style={styles.eyebrow}>SOUND</Text>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Equalizer</Text>
          <Switch
            testID="equalizer-toggle"
            value={eqEnabled}
            onValueChange={setEqEnabled}
            trackColor={{ false: theme.palette.border, true: theme.palette.primary }}
            thumbColor={theme.palette.text.primary}
          />
        </View>

        <GlassCard style={styles.statusCard} testID="eq-status-card">
          {eqNative?.available ? (
            <>
              <Text style={styles.statusBadge}>● DSP AKTIV</Text>
              <Text style={styles.statusText}>
                Native System-Equalizer mit {eqNative.bands.length} Bändern aktiv. Filtert
                den globalen Audio-Output deines Geräts.
              </Text>
              <Text style={styles.statusFreq}>
                {eqNative.bands.map(b => formatHz(b.centerFreqHz)).join(' · ')} Hz
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.statusBadge, styles.statusBadgeOff]}>○ NUR UI</Text>
              <Text style={styles.statusText}>
                Native Equalizer-API nicht verfügbar. Werte werden nur visuell dargestellt
                und gespeichert. Auf Custom-Dev-Client / EAS-Build aktiv.
              </Text>
            </>
          )}
        </GlassCard>

        <Text style={styles.sectionTitle}>Presets</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetRow}
        >
          {PRESET_KEYS.map(key => {
            const active = eqPreset === key;
            return (
              <Pressable
                key={key}
                testID={`eq-preset-${key}`}
                accessibilityRole="button"
                accessibilityLabel={`Preset ${PRESET_LABELS[key]}`}
                onPress={() => applyEqPreset(key)}
                style={({ pressed }) => [
                  styles.preset,
                  active && styles.presetActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.presetText, active && styles.presetTextActive]}>
                  {PRESET_LABELS[key]}
                </Text>
              </Pressable>
            );
          })}
          {eqPreset === 'custom' && (
            <View style={[styles.preset, styles.presetActive]} testID="eq-preset-custom">
              <Text style={[styles.presetText, styles.presetTextActive]}>Custom</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.bandsRow}>
          {EQ_BAND_LABELS.map((label, i) => (
            <View key={label} style={styles.bandCol}>
              <Text style={styles.bandValue}>
                {(eqBands[i] ?? 0) > 0 ? '+' : ''}
                {(eqBands[i] ?? 0).toFixed(0)}
              </Text>
              <Slider
                testID={`eq-band-${label}`}
                style={styles.verticalSlider}
                minimumValue={-12}
                maximumValue={12}
                step={1}
                value={eqBands[i] ?? 0}
                onValueChange={v => setEqBand(i, v)}
                disabled={!eqEnabled}
                minimumTrackTintColor={theme.palette.primary}
                maximumTrackTintColor={theme.palette.border}
                thumbTintColor={theme.palette.primary}
              />
              <Text style={styles.bandLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
  eyebrow: {
    color: theme.palette.primary,
    fontSize: 10,
    letterSpacing: 1.8,
    fontFamily: theme.fonts.body,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: 32,
    fontFamily: theme.fonts.display,
    letterSpacing: -1.0,
    color: theme.palette.text.primary,
  },
  statusCard: {
    marginBottom: theme.spacing.lg,
  },
  statusBadge: {
    color: theme.palette.success,
    fontSize: 11,
    letterSpacing: 1.6,
    fontFamily: theme.fonts.heading,
    marginBottom: 6,
  },
  statusBadgeOff: { color: theme.palette.warning },
  statusText: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontFamily: theme.fonts.body,
    lineHeight: 18,
  },
  statusFreq: {
    color: theme.palette.text.muted,
    fontSize: 11,
    fontFamily: theme.fonts.mono,
    marginTop: 6,
  },
  sectionTitle: {
    color: theme.palette.text.muted,
    fontSize: 11,
    letterSpacing: 1.6,
    fontFamily: theme.fonts.body,
    marginBottom: theme.spacing.sm,
  },
  presetRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    paddingRight: theme.spacing.md,
  },
  preset: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.pill,
    backgroundColor: theme.palette.surface,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  presetActive: {
    backgroundColor: theme.palette.primary,
    borderColor: theme.palette.primaryDark,
  },
  presetText: {
    color: theme.palette.text.secondary,
    fontFamily: theme.fonts.heading,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  presetTextActive: { color: theme.palette.text.onPrimary },
  pressed: { opacity: 0.75 },
  bandsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: theme.spacing.lg,
    height: 240,
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
  bandValue: {
    color: theme.palette.text.secondary,
    fontSize: 10,
    fontFamily: theme.fonts.mono,
  },
  bandLabel: {
    color: theme.palette.text.primary,
    fontSize: 11,
    marginTop: theme.spacing.sm,
    fontFamily: theme.fonts.body,
  },
});

export default Equalizer;
