import React, { useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import type { ColorValue, ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../contexts/AppThemeContext';
import { getNowPlayingBackdropOverlayColors } from '../utils/appThemeOverlays';
import { useColorCrossfade } from '../hooks/useColorCrossfade';

type GradientColors = readonly [ColorValue, ColorValue, ...ColorValue[]];

interface NowPlayingBackdropProps {
  gradientColors: GradientColors;
  accent: string;
  glowLeft: number;
  artworkUri?: string;
  paletteLoading?: boolean;
}

interface BackdropSnapshot extends NowPlayingBackdropProps {
  key: string;
  artworkSource: ImageSourcePropType | null;
}

const buildSnapshot = ({ gradientColors, accent, glowLeft, artworkUri }: NowPlayingBackdropProps): BackdropSnapshot => ({
  gradientColors,
  accent,
  glowLeft,
  artworkUri,
  artworkSource: artworkUri ? { uri: artworkUri } : null,
  key: `${gradientColors.map(String).join('|')}|${accent}|${glowLeft}|${artworkUri ?? ''}`,
});

const BackdropLayer = ({ snapshot, opacity, artworkTestId }: {
  snapshot: BackdropSnapshot;
  opacity: number | Animated.Value;
  artworkTestId: string;
}) => (
  <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}
    testID={`${artworkTestId}-layer`}>
    {snapshot.artworkSource ? (
      <Animated.Image source={snapshot.artworkSource} resizeMode="cover" resizeMethod="resize"
        fadeDuration={0} blurRadius={28} accessible={false} style={styles.coverBackdrop}
        testID={artworkTestId} />
    ) : null}
    <LinearGradient colors={snapshot.gradientColors} start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
    <View style={[styles.glowOrb, { backgroundColor: snapshot.accent, left: snapshot.glowLeft }]} />
  </Animated.View>
);

const NowPlayingBackdrop: React.FC<NowPlayingBackdropProps> = ({
  gradientColors,
  accent,
  glowLeft,
  artworkUri,
}) => {
  const { theme } = useAppTheme();
  const overlayColors = getNowPlayingBackdropOverlayColors(theme.appearance);
  const incoming = useMemo(
    () => buildSnapshot({ gradientColors, accent, glowLeft, artworkUri }),
    [accent, artworkUri, glowLeft, gradientColors],
  );
  const { active, outgoing, transition } = useColorCrossfade(incoming, incoming.key);

  return (
    <>
      {outgoing.map((layer, index) => {
        const accumulated = outgoing.slice(0, index + 1).reduce((sum, item) => sum + item.weight, 0);
        return <BackdropLayer key={`${layer.key}:${index}`} snapshot={layer.value}
          opacity={index === 0 ? 1 : layer.weight / accumulated}
          artworkTestId={`now-playing-cover-backdrop-outgoing${index ? `-${index}` : ''}`} />;
      })}
      <BackdropLayer snapshot={active.value} opacity={outgoing.length ? transition : 1}
        artworkTestId="now-playing-cover-backdrop" />
      <LinearGradient colors={overlayColors} style={StyleSheet.absoluteFill} pointerEvents="none" />
    </>
  );
};

const styles = StyleSheet.create({
  coverBackdrop: { ...StyleSheet.absoluteFillObject, opacity: 0.18, transform: [{ scale: 1.08 }] },
  glowOrb: { position: 'absolute', width: 260, height: 260, borderRadius: 130, top: 150, opacity: 0.14 },
});

export default React.memo(NowPlayingBackdrop);
