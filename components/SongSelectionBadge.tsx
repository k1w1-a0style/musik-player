import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
const SongSelectionBadge: React.FC<{ state: 0 | 1 | 2 }> = ({ state }) => {
  const { theme } = useAppTheme();
  if (!state) return null;
  return <View pointerEvents="none" style={[styles.badge, { backgroundColor: state === 2 ? theme.palette.primary : theme.palette.surface,
    borderColor: theme.palette.primary }]}>
    <Text style={{ color: theme.palette.text.onPrimary, fontSize: 16 }}>{state === 2 ? '✓' : ''}</Text>
  </View>;
};
const styles = StyleSheet.create({ badge: { position: 'absolute', top: 1, left: 1, width: 24, height: 24, borderRadius: 6,
  alignItems: 'center', justifyContent: 'center', borderWidth: 2 } });
export default SongSelectionBadge;
