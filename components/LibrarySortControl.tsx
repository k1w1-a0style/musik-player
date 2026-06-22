import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { ArrowDownUp } from 'lucide-react-native';
import { theme } from '../theme';
import { getLibrarySortModeLabel, type LibrarySortMode } from '../utils/librarySort';

interface LibrarySortControlProps {
  mode: LibrarySortMode;
  onCycle: () => void;
}

const LibrarySortControl: React.FC<LibrarySortControlProps> = ({ mode, onCycle }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel="Sortierung wechseln"
    accessibilityValue={{ text: getLibrarySortModeLabel(mode) }}
    onPress={onCycle}
    style={({ pressed }) => [styles.control, pressed && styles.pressed]}
    testID="library-sort-control"
  >
    <ArrowDownUp color={theme.palette.text.secondary} size={14} />
    <Text style={styles.label} testID="library-sort-control-label">{getLibrarySortModeLabel(mode)}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  pressed: { opacity: 0.72 },
  label: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 12, letterSpacing: 0.3 },
});

export default LibrarySortControl;
