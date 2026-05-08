import React from 'react';
import { StyleSheet, ViewStyle, StyleProp, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

interface AppBackgroundProps { children: React.ReactNode; style?: StyleProp<ViewStyle>; variant?: 'default' | 'nowPlaying'; }
const Orb: React.FC<{ color: string; size: number; start: { x: number; y: number }; opacity: number }> = ({ color, size, start, opacity }) => (
  <View pointerEvents="none" style={[styles.orbBase, { width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity, transform: [{ translateX: start.x }, { translateY: start.y }] }]} />
);
const AppBackground: React.FC<AppBackgroundProps> = ({ children, style, variant = 'default' }) => {
  const gradient = variant === 'nowPlaying' ? theme.gradients.nowPlaying : theme.gradients.background;
  return (
    <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.root, style]}>
      <Orb color={theme.palette.primaryGlow} size={300} start={{ x: -110, y: -110 }} opacity={0.22} />
      <Orb color={theme.palette.primaryGlow} size={250} start={{ x: 180, y: 460 }} opacity={0.16} />
      <Orb color={theme.palette.accentGlow} size={200} start={{ x: 210, y: 40 }} opacity={0.12} />
      {children}
    </LinearGradient>
  );
};
const styles = StyleSheet.create({ root: { flex: 1 }, orbBase: { position: 'absolute' } });
export default AppBackground;
