import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { LayoutGrid } from 'lucide-react-native';
import { theme } from '../theme';
import { getLibrarySongViewModeLabel, type LibrarySongViewMode } from '../utils/libraryViewMode';

interface LibrarySongViewControlProps {
  mode: LibrarySongViewMode;
  onCycle: () => void;
}

const LibrarySongViewControl: React.FC<LibrarySongViewControlProps> = ({ mode, onCycle }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel="Ansicht wechseln"
    accessibilityValue={{ text: getLibrarySongViewModeLabel(mode) }}
    onPress={onCycle}
    style={({ pressed }) => [styles.control, pressed && styles.pressed]}
    testID="library-song-view-control"
  >
    <LayoutGrid color={theme.palette.text.secondary} size={14} />
    <Text style={styles.label} testID="library-song-view-control-label">{getLibrarySongViewModeLabel(mode)}</Text>
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

export default LibrarySongViewControl;
