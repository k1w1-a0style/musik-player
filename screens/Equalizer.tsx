import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, Pressable } from 'react-native';
import Slider from '@react-native-community/slider';
import Svg, { Path, Line } from 'react-native-svg';
import { useMusicContext } from '../contexts/MusicContext';
import AppBackground from '../components/AppBackground';
import GlassCard from '../components/GlassCard';
import { EQ_BAND_LABELS, EQ_PRESETS, type EqPresetName } from '../types/Song';
import { theme } from '../theme';

const PRESET_LABELS: Record<EqPresetName, string> = { flat: 'Flat', rock: 'Rock', pop: 'Pop', jazz: 'Jazz', bassBoost: 'Bass+', vocal: 'Vocal', electronic: 'Electronic' };
const PRESET_KEYS = Object.keys(EQ_PRESETS) as EqPresetName[];
const formatHz = (hz: number): string => (hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${hz}`);

const Equalizer: React.FC = () => {
  const { eqEnabled, setEqEnabled, eqBands, setEqBand, eqPreset, applyEqPreset, eqNative } = useMusicContext();

  const curvePath = useMemo(() => {
    const width = 320;
    const height = 80;
    const points = eqBands.map((db, i) => {
      const x = (i / Math.max(1, eqBands.length - 1)) * width;
      const y = ((12 - db) / 24) * height;
      return { x, y };
    });
    if (points.length < 2) return 'M0,40 L320,40';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i += 1) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const cx1 = p0.x + (p1.x - p0.x) / 3;
      const cx2 = p0.x + ((p1.x - p0.x) * 2) / 3;
      d += ` C ${cx1} ${p0.y}, ${cx2} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return d;
  }, [eqBands]);

  return (
    <AppBackground>
      <ScrollView style={styles.container} testID="equalizer-screen">
        <Text style={styles.eyebrow}>SOUND</Text>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Equalizer</Text>
          <Switch value={eqEnabled} onValueChange={setEqEnabled} trackColor={{ false: theme.palette.border, true: theme.palette.primary }} thumbColor={theme.palette.text.primary} />
        </View>

        <GlassCard style={styles.statusCard}>
          {eqNative?.available ? (
            <>
              <Text style={styles.statusBadge}>● DSP AKTIV</Text>
              <Text style={styles.statusText}>Native System-Equalizer mit {eqNative.bands.length} Bändern aktiv.</Text>
              <Text style={styles.statusFreq}>{eqNative.bands.map(b => formatHz(b.centerFreqHz)).join(' · ')} Hz</Text>
            </>
          ) : (
            <>
              <Text style={[styles.statusBadge, styles.statusBadgeOff]}>○ NUR UI</Text>
              <Text style={styles.statusText}>Native Equalizer-API nicht verfügbar. Auf Custom-Dev-Client / EAS-Build aktiv.</Text>
            </>
          )}
        </GlassCard>

        <View style={styles.curveWrap}>
          <Svg width="100%" height="80" viewBox="0 0 320 80">
            <Line x1="0" y1="40" x2="320" y2="40" stroke={theme.palette.borderStrong} strokeDasharray="4,4" strokeWidth="1" />
            <Path d={curvePath} stroke={theme.palette.primary} strokeWidth={2} fill="rgba(245,179,1,0.08)" />
          </Svg>
        </View>

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
      </ScrollView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.md },
  eyebrow: { color: theme.palette.primary, fontSize: 10, letterSpacing: 1.8, fontFamily: theme.fonts.body },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md },
  title: { fontSize: 32, fontFamily: theme.fonts.display, letterSpacing: -1, color: theme.palette.text.primary },
  statusCard: { marginBottom: theme.spacing.md },
  statusBadge: { color: theme.palette.success, fontSize: 11, letterSpacing: 1.6, fontFamily: theme.fonts.heading, marginBottom: 6 },
  statusBadgeOff: { color: theme.palette.warning },
  statusText: { color: theme.palette.text.secondary, fontSize: 12, fontFamily: theme.fonts.body, lineHeight: 18 },
  statusFreq: { color: theme.palette.text.muted, fontSize: 11, fontFamily: theme.fonts.mono, marginTop: 6 },
  curveWrap: { marginBottom: theme.spacing.md, borderWidth: 1, borderColor: theme.palette.border, backgroundColor: theme.palette.surface, borderRadius: theme.borderRadius.md, padding: 8 },
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
