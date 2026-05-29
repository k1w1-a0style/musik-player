import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { ColorValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { theme } from '../theme';

type GradientColors = readonly [ColorValue, ColorValue, ...ColorValue[]];

interface NowPlayingBackdropProps {
  gradientColors: GradientColors;
  accent: string;
  glowLeft: number;
}

const NowPlayingBackdrop: React.FC<NowPlayingBackdropProps> = ({
  gradientColors,
  accent,
  glowLeft,
}) => (
  <>
    <LinearGradient
      pointerEvents="none"
      colors={gradientColors}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
    <View pointerEvents="none" style={[styles.glowOrb, { backgroundColor: accent, left: glowLeft }]} />
    <BlurView pointerEvents="none" intensity={theme.blur.medium} tint="dark" style={StyleSheet.absoluteFill} />
    <LinearGradient
      colors={['rgba(5,6,10,0.0)', 'rgba(5,6,10,0.55)', 'rgba(5,6,10,0.95)']}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  </>
);

const styles = StyleSheet.create({
  glowOrb: { position: 'absolute', width: 260, height: 260, borderRadius: 130, top: 150, opacity: 0.14 },
});

export default NowPlayingBackdrop;
