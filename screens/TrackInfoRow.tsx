import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { APP_THEME_TOKENS } from '../utils/appTheme';

interface TrackInfoRowProps {
  label: string;
  value: string;
  long?: boolean;
}

const TrackInfoRow: React.FC<TrackInfoRowProps> = ({ label, value, long = false }) => {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.row, long && styles.longRow, { borderBottomColor: theme.palette.border }]}
      accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.label, { color: theme.palette.text.muted }]}>{label}</Text>
      <Text selectable={long} numberOfLines={long ? undefined : 3}
        style={[styles.value, long && styles.longValue, { color: theme.palette.text.primary }]}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  longRow: { minHeight: 64, alignItems: 'flex-start', flexDirection: 'column', gap: 5 },
  label: { width: 116, fontFamily: APP_THEME_TOKENS.fonts.body, fontSize: 10,
    lineHeight: 14, letterSpacing: 0.8, textTransform: 'uppercase' },
  value: { flex: 1, textAlign: 'right', fontFamily: APP_THEME_TOKENS.fonts.heading,
    fontSize: 14, lineHeight: 19 },
  longValue: { width: '100%', textAlign: 'left', fontFamily: APP_THEME_TOKENS.fonts.mono,
    fontSize: 11, lineHeight: 17 },
});

export default TrackInfoRow;
