import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { Song } from '../types/Song';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useWaveformStatus } from '../hooks/useWaveformStatus';

const LABELS = { pending: 'Waveform ausstehend', analyzing: 'Waveform wird vorbereitet',
  ready: 'Waveform bereit', unavailable: 'Waveform nicht verfügbar' } as const;
const SYMBOLS = { pending: '○', analyzing: '', ready: '✓', unavailable: '!' } as const;

const SongWaveformStatus = ({ song }: { song: Song }) => {
  const status = useWaveformStatus(song);
  const { theme } = useAppTheme();
  const color = status === 'ready' ? theme.palette.primary : theme.palette.text.muted;
  return <View style={styles.badge} accessible accessibilityLabel={LABELS[status]}
    accessibilityState={{ busy: status === 'analyzing' }} testID={`song-waveform-status-${song.id}`}>
    {status === 'analyzing' ? <ActivityIndicator color={color} size="small" />
      : <Text style={[styles.symbol, { color }]}>{SYMBOLS[status]}</Text>}
  </View>;
};
const styles = StyleSheet.create({
  badge: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  symbol: { fontSize: 16, fontWeight: '600' },
});
export default React.memo(SongWaveformStatus);
