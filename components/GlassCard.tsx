import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { theme as staticTheme } from '../theme';
import { useAppTheme } from '../contexts/AppThemeContext';

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
  tint,
  glow = false,
  testID,
}) => {
  const { appearance, theme } = useAppTheme();
  const resolvedTint = tint ?? (appearance === 'light' ? 'light' : 'dark');
  const glassGradient = [theme.palette.surfaceGlass, theme.palette.primaryGlow] as const;
  const glowStyle = glow
    ? {
        shadowColor: theme.palette.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 18,
        elevation: 9,
      }
    : null;

  return (
    <View
      style={[
        styles.wrapper,
        {
          borderColor: theme.palette.border,
          backgroundColor: theme.palette.surfaceGlass,
        },
        glowStyle,
        style,
      ]}
      testID={testID}
    >
      <BlurView pointerEvents="none" intensity={intensity} tint={resolvedTint} style={StyleSheet.absoluteFill} />
      <LinearGradient
        pointerEvents="none"
        colors={glassGradient}
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
    borderRadius: staticTheme.borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
  },
  content: {
    padding: staticTheme.spacing.md,
  },
});

export default GlassCard;
