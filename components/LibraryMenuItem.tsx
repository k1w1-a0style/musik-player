import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { APP_THEME_TOKENS as staticTokens } from '../utils/appTheme';
import { useAppTheme } from '../contexts/AppThemeContext';

type MenuIcon = React.ElementType<{ color?: string; size?: number }>;

interface LibraryMenuItemProps {
  label: string;
  description?: string;
  onPress: () => void;
  disabled?: boolean;
  muted?: boolean;
  icon?: MenuIcon;
}

const sanitizeTestId = (label: string): string =>
  label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const LibraryMenuItem: React.FC<LibraryMenuItemProps> = ({ label, description, onPress, disabled, muted, icon: Icon }) => {
  const { theme } = useAppTheme();
  const color = muted ? theme.palette.text.secondary : theme.palette.text.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={description}
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
      <View style={styles.textBlock}>
        <Text style={[styles.menuText, muted && styles.menuTextMuted, { color }]}>{label}</Text>
        {description ? <Text style={[styles.description, { color: theme.palette.text.secondary }]}>{description}</Text> : null}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  menuItem: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 22 },
  iconSlot: { width: 20, alignItems: 'center' },
  menuText: { fontFamily: staticTokens.fonts.body, fontSize: 18, letterSpacing: -0.3 },
  menuTextMuted: { fontSize: 14 },
  textBlock: { flex: 1, paddingVertical: 8 },
  description: { fontSize: 12, marginTop: 3 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
});

export default LibraryMenuItem;
