import React from 'react';
import { StyleSheet, Text } from 'react-native';
import type { EqInitResult } from 'expo-system-audio';
import GlassCard from '../components/GlassCard';
import { theme as staticTheme } from '../theme';
import { useAppTheme } from '../contexts/AppThemeContext';
import { formatHz } from './equalizerHelpers';

interface EqualizerStatusCardProps {
  eqNative: EqInitResult | null;
}

const EqualizerStatusCard: React.FC<EqualizerStatusCardProps> = ({ eqNative }) => {
  const { theme } = useAppTheme();

  return (
    <GlassCard style={styles.statusCard}>
      {eqNative?.available ? (
        <>
          <Text style={[styles.statusBadge, { color: theme.palette.warning }]}>● EXPERIMENTELL</Text>
          <Text style={[styles.statusText, { color: theme.palette.text.secondary }]}>Native Equalizer-API verfügbar. Wirkung kann je nach Gerät, Android-Version und Audio-Session variieren.</Text>
          <Text style={[styles.statusFreq, { color: theme.palette.text.muted }]}>{eqNative.bands.map(b => formatHz(b.centerFreqHz)).join(' · ')} Hz</Text>
        </>
      ) : (
        <>
          <Text style={[styles.statusBadge, { color: theme.palette.warning }]}>○ NUR UI</Text>
          <Text style={[styles.statusText, { color: theme.palette.text.secondary }]}>Native Equalizer-API nicht verfügbar. Auf Custom-Dev-Client / EAS-Build erneut prüfen.</Text>
        </>
      )}
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  statusCard: { marginBottom: staticTheme.spacing.md },
  statusBadge: { fontSize: 11, letterSpacing: 1.6, fontFamily: staticTheme.fonts.heading, marginBottom: 6 },
  statusText: { fontSize: 12, fontFamily: staticTheme.fonts.body, lineHeight: 18 },
  statusFreq: { fontSize: 11, fontFamily: staticTheme.fonts.mono, marginTop: 6 },
});

export default EqualizerStatusCard;
