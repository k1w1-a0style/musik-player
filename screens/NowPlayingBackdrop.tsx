import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { ColorValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { theme } from '../theme';

type GradientColors = readonly [ColorValue, ColorValue, ...ColorValue[]];

interface NowPlayingBackdropProps {
  gradientColors: GradientColors;
  accent: string;
  glowLeft: number;
  artworkUri?: string;
}

const NowPlayingBackdrop: React.FC<NowPlayingBackdropProps> = ({
  gradientColors,
  accent,
  glowLeft,
  artworkUri,
}) => (
  <>
    {artworkUri ? (
      <Image
        pointerEvents="none"
        source={{ uri: artworkUri }}
        resizeMode="cover"
        blurRadius={28}
        style={styles.coverBackdrop}
        testID="now-playing-cover-backdrop"
      />
    ) : null}
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
  coverBackdrop: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.18,
    transform: [{ scale: 1.08 }],
  },
  glowOrb: { position: 'absolute', width: 260, height: 260, borderRadius: 130, top: 150, opacity: 0.14 },
});

export default NowPlayingBackdrop;
