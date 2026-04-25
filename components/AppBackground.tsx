import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

interface AppBackgroundProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'nowPlaying';
}

const AppBackground: React.FC<AppBackgroundProps> = ({
  children,
  style,
  variant = 'default',
}) => {
  const gradient =
    variant === 'nowPlaying' ? theme.gradients.nowPlaying : theme.gradients.background;
  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.root, style]}
    >
      {/* Soft radial-like orb top-left */}
      <View style={styles.orbAmber} pointerEvents="none" />
      <View style={styles.orbIndigo} pointerEvents="none" />
      {children}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  orbAmber: {
    position: 'absolute',
    top: -120,
    left: -120,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: theme.palette.primary,
    opacity: 0.07,
  },
  orbIndigo: {
    position: 'absolute',
    bottom: -180,
    right: -100,
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: theme.palette.accent,
    opacity: 0.08,
  },
});

export default AppBackground;
