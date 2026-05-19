import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '../theme';

interface LibraryMenuItemProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  muted?: boolean;
}

const sanitizeTestId = (label: string): string =>
  label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const LibraryMenuItem: React.FC<LibraryMenuItemProps> = ({ label, onPress, disabled, muted }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled: !!disabled }}
    disabled={disabled}
    onPress={onPress}
    testID={`library-menu-item-${sanitizeTestId(label)}`}
    style={({ pressed }) => [styles.menuItem, pressed && styles.pressed, disabled && styles.disabled]}
  >
    <Text style={[styles.menuText, muted && styles.menuTextMuted]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  menuItem: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 22 },
  menuText: { color: theme.palette.text.primary, fontFamily: theme.fonts.body, fontSize: 18, letterSpacing: -0.3 },
  menuTextMuted: { color: theme.palette.text.secondary, fontSize: 14 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
});

export default LibraryMenuItem;
