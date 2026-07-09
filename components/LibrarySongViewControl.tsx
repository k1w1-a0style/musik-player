import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { LayoutGrid } from 'lucide-react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { theme as staticTheme } from '../theme';
import { getLibrarySongViewModeLabel, type LibrarySongViewMode } from '../utils/libraryViewMode';

interface LibrarySongViewControlProps {
  mode: LibrarySongViewMode;
  onCycle: () => void;
}

const LibrarySongViewControl: React.FC<LibrarySongViewControlProps> = ({ mode, onCycle }) => {
  const { theme } = useAppTheme();
  const label = getLibrarySongViewModeLabel(mode);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ansicht wechseln"
      accessibilityValue={{ text: label }}
      onPress={onCycle}
      style={({ pressed }) => [
        styles.control,
        { backgroundColor: theme.palette.surfaceGlass, borderColor: theme.palette.border },
        pressed && styles.pressed,
      ]}
      testID="library-song-view-control"
    >
      <LayoutGrid color={theme.palette.text.secondary} size={14} />
      <Text style={[styles.label, { color: theme.palette.text.secondary }]} testID="library-song-view-control-label">
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.72 },
  label: {
    fontFamily: staticTheme.fonts.body,
    fontSize: 12,
    letterSpacing: 0.3,
  },
});

export default LibrarySongViewControl;
