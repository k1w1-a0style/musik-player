import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme as staticTheme } from '../theme';
import { useAppTheme } from '../contexts/AppThemeContext';

type MenuIcon = React.ComponentType<{ color?: string; size?: number }>;

interface LibraryMenuItemProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  muted?: boolean;
  icon?: MenuIcon;
}

const sanitizeTestId = (label: string): string =>
  label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const LibraryMenuItem: React.FC<LibraryMenuItemProps> = ({ label, onPress, disabled, muted, icon: Icon }) => {
  const { theme } = useAppTheme();
  const color = muted ? theme.palette.text.secondary : theme.palette.text.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={`library-menu-item-${sanitizeTestId(label)}`}
      style={({ pressed }) => [styles.menuItem, pressed && styles.pressed, disabled && styles.disabled]}
    >
      {Icon ? (
        <View style={styles.iconSlot} testID={`library-menu-item-icon-${sanitizeTestId(label)}`}>
          <Icon color={color} size={18} />
        </View>
      ) : null}
      <Text style={[styles.menuText, muted && styles.menuTextMuted, { color }]}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  menuItem: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 22 },
  iconSlot: { width: 20, alignItems: 'center' },
  menuText: { fontFamily: staticTheme.fonts.body, fontSize: 18, letterSpacing: -0.3 },
  menuTextMuted: { fontSize: 14 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
});

export default LibraryMenuItem;
