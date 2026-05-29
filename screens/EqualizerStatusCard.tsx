import React from 'react';
import { StyleSheet, Text } from 'react-native';
import type { EqInitResult } from 'expo-system-audio';
import GlassCard from '../components/GlassCard';
import { theme } from '../theme';
import { formatHz } from './equalizerHelpers';

interface EqualizerStatusCardProps {
  eqNative: EqInitResult | null;
}

const EqualizerStatusCard: React.FC<EqualizerStatusCardProps> = ({ eqNative }) => (
  <GlassCard style={styles.statusCard}>
    {eqNative?.available ? (
      <>
        <Text style={styles.statusBadge}>● EXPERIMENTELL</Text>
        <Text style={styles.statusText}>Native Equalizer-API verfügbar. Wirkung kann je nach Gerät, Android-Version und Audio-Session variieren.</Text>
        <Text style={styles.statusFreq}>{eqNative.bands.map(b => formatHz(b.centerFreqHz)).join(' · ')} Hz</Text>
      </>
    ) : (
      <>
        <Text style={[styles.statusBadge, styles.statusBadgeOff]}>○ NUR UI</Text>
        <Text style={styles.statusText}>Native Equalizer-API nicht verfügbar. Auf Custom-Dev-Client / EAS-Build erneut prüfen.</Text>
      </>
    )}
  </GlassCard>
);

const styles = StyleSheet.create({
  statusCard: { marginBottom: theme.spacing.md },
  statusBadge: { color: theme.palette.warning, fontSize: 11, letterSpacing: 1.6, fontFamily: theme.fonts.heading, marginBottom: 6 },
  statusBadgeOff: { color: theme.palette.warning },
  statusText: { color: theme.palette.text.secondary, fontSize: 12, fontFamily: theme.fonts.body, lineHeight: 18 },
  statusFreq: { color: theme.palette.text.muted, fontSize: 11, fontFamily: theme.fonts.mono, marginTop: 6 },
});

export default EqualizerStatusCard;
