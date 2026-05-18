import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '../theme';

interface NowPlayingMenuItemProps {
  label: string;
  onPress: () => void;
}

const NowPlayingMenuItem: React.FC<NowPlayingMenuItemProps> = ({ label, onPress }) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
  >
    <Text style={styles.menuText}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  menuItem: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 18 },
  menuText: { color: theme.palette.text.primary, fontFamily: theme.fonts.body, fontSize: 16 },
  pressed: { opacity: 0.72 },
});

export default NowPlayingMenuItem;
