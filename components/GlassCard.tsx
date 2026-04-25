import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  glow?: boolean;
  testID?: string;
}

const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  intensity = 40,
  tint = 'dark',
  glow = false,
  testID,
}) => {
  return (
    <View style={[styles.wrapper, glow && styles.glow, style]} testID={testID}>
      <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={theme.gradients.glass}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.surfaceGlass,
  },
  glow: theme.shadows.glow,
  content: {
    padding: theme.spacing.md,
  },
});

export default GlassCard;
