import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { theme as staticTheme } from '../theme';
import { useAppTheme } from '../contexts/AppThemeContext';

interface NowPlayingMenuItemProps {
  label: string;
  onPress: () => void;
}

const NowPlayingMenuItem: React.FC<NowPlayingMenuItemProps> = ({ label, onPress }) => {
  const { theme } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
    >
      <Text style={[styles.menuText, { color: theme.palette.text.primary }]}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  menuItem: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 18 },
  menuText: { fontFamily: staticTheme.fonts.body, fontSize: 16 },
  pressed: { opacity: 0.72 },
});

export default NowPlayingMenuItem;
