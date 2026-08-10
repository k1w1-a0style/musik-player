import React, { useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { ColorValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../contexts/AppThemeContext';
import { getNowPlayingBackdropOverlayColors } from '../utils/appThemeOverlays';

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
}) => {
  const { theme } = useAppTheme();
  const overlayColors = getNowPlayingBackdropOverlayColors(theme.appearance);
  const artworkSource = useMemo(() => artworkUri ? { uri: artworkUri } : null, [artworkUri]);

  return (
    <>
      {artworkSource ? (
        <Image source={artworkSource} resizeMode="cover" resizeMethod="resize" fadeDuration={0}
          blurRadius={28} accessible={false} style={styles.coverBackdrop}
          testID="now-playing-cover-backdrop" />
      ) : null}
      <LinearGradient
        pointerEvents="none"
        colors={gradientColors}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={[styles.glowOrb, { backgroundColor: accent, left: glowLeft }]} />
      <LinearGradient colors={overlayColors} style={StyleSheet.absoluteFill} pointerEvents="none" />
    </>
  );
};

const styles = StyleSheet.create({
  coverBackdrop: { ...StyleSheet.absoluteFillObject, opacity: 0.18, transform: [{ scale: 1.08 }] },
  glowOrb: { position: 'absolute', width: 260, height: 260, borderRadius: 130, top: 150, opacity: 0.14 },
});

export default React.memo(NowPlayingBackdrop);
