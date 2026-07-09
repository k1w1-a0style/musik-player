import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { ArrowDownUp } from 'lucide-react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { getLibrarySortModeLabel, type LibrarySortMode } from '../utils/librarySort';

interface LibrarySortControlProps {
  mode: LibrarySortMode;
  onCycle: () => void;
}

const LibrarySortControl: React.FC<LibrarySortControlProps> = ({ mode, onCycle }) => {
  const { theme } = useAppTheme();
  const label = getLibrarySortModeLabel(mode);
  const { fonts, radii, spacing } = theme.tokens;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Sortierung wechseln"
      accessibilityValue={{ text: label }}
      onPress={onCycle}
      style={({ pressed }) => [
        styles.control,
        {
          backgroundColor: theme.palette.surfaceGlass,
          borderColor: theme.palette.border,
          borderRadius: radii.control,
          gap: spacing.xs + 2,
          paddingHorizontal: spacing.md - 2,
        },
        pressed && styles.pressed,
      ]}
      testID="library-sort-control"
    >
      <ArrowDownUp color={theme.palette.text.secondary} size={14} />
      <Text
        style={[
          styles.label,
          {
            color: theme.palette.text.secondary,
            fontFamily: fonts.body,
          },
        ]}
        testID="library-sort-control-label"
      >
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.72 },
  label: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
});

export default LibrarySortControl;
