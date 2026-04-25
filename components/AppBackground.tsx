import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { theme } from '../theme';

interface AppBackgroundProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'nowPlaying';
}

const Orb: React.FC<{ color: string; size: number; start: { x: number; y: number }; end: { x: number; y: number }; opacity: number; duration: number }> = ({ color, size, start, end, opacity, duration }) => {
  const x = useSharedValue(start.x);
  const y = useSharedValue(start.y);
  useEffect(() => {
    x.value = withRepeat(withTiming(end.x, { duration, easing: Easing.inOut(Easing.sin) }), -1, true);
    y.value = withRepeat(withTiming(end.y, { duration: duration + 2000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [x, y, end.x, end.y, duration]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }] }));
  return <Animated.View pointerEvents="none" style={[styles.orbBase, { width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity }, animatedStyle]} />;
};

const AppBackground: React.FC<AppBackgroundProps> = ({ children, style, variant = 'default' }) => {
  const gradient = variant === 'nowPlaying' ? theme.gradients.nowPlaying : theme.gradients.background;
  return (
    <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.root, style]}>
      <Orb color={theme.palette.primaryGlow} size={320} start={{ x: -120, y: -110 }} end={{ x: -80, y: -70 }} opacity={0.2} duration={10000} />
      <Orb color={theme.palette.accentGlow} size={360} start={{ x: 150, y: 460 }} end={{ x: 110, y: 420 }} opacity={0.2} duration={12000} />
      <Orb color={theme.palette.accentGlow} size={220} start={{ x: 220, y: -80 }} end={{ x: 180, y: -30 }} opacity={0.15} duration={8000} />
      {children}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  orbBase: { position: 'absolute' },
});

export default AppBackground;
