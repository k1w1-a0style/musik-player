import React, { useEffect, useMemo, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import type { ColorValue, ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../contexts/AppThemeContext';
import { blendBackdropColor, getNowPlayingBackdropOverlayColors } from '../utils/appThemeOverlays';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useArtworkThumbnail } from '../hooks/useArtworkThumbnail';
import { useColorCrossfade, type ColorLayer } from '../hooks/useColorCrossfade';

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

// Preserve all palette weights while collapsing the oldest low-opacity images
// to one representative thumbnail. Thus a rapid burst stays at three layers.
export const mergeBackdropLayers = (left: ColorLayer<BackdropSnapshot>,
  right: ColorLayer<BackdropSnapshot>): ColorLayer<BackdropSnapshot> => {
  const weight = left.weight + right.weight;
  const fraction = weight > 0 ? right.weight / weight : 0;
  const representative = fraction < 0.5 ? left.value : right.value;
  const gradientColors = left.value.gradientColors.map((color, index) => blendBackdropColor(color,
    right.value.gradientColors[index] ?? right.value.gradientColors[right.value.gradientColors.length - 1], fraction)) as unknown as GradientColors;
  const value = { ...representative, gradientColors,
    accent: String(blendBackdropColor(left.value.accent, right.value.accent, fraction)),
    glowLeft: left.value.glowLeft * (1 - fraction) + right.value.glowLeft * fraction };
  return { key: `mixture:${gradientColors.join('|')}|${value.artworkUri ?? ''}`,
    value, weight };
};

const BackdropLayer = ({ snapshot, opacity, artworkTestId }: {
  snapshot: BackdropSnapshot;
  opacity: number | Animated.Value;
  artworkTestId: string;
}) => {
  const thumbnailUri = useArtworkThumbnail(snapshot.artworkUri, 64);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  useEffect(() => setThumbnailFailed(false), [snapshot.artworkUri, thumbnailUri]);
  const source = useMemo(() => !thumbnailFailed && thumbnailUri ? { uri: thumbnailUri } : snapshot.artworkSource,
    [snapshot.artworkSource, thumbnailFailed, thumbnailUri]);
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}
      testID={`${artworkTestId}-layer`}>
      {source ? (
        <Animated.Image source={source} resizeMode="cover" resizeMethod="resize"
          onError={thumbnailUri !== snapshot.artworkUri && !thumbnailFailed ? () => setThumbnailFailed(true) : undefined}
          fadeDuration={0} accessible={false} style={styles.coverBackdrop}
          testID={artworkTestId} />
      ) : null}
      <LinearGradient colors={snapshot.gradientColors} start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[styles.glowOrb, { backgroundColor: snapshot.accent, left: snapshot.glowLeft }]} />
    </Animated.View>
  );
};

const NowPlayingBackdrop: React.FC<NowPlayingBackdropProps> = ({
  gradientColors,
  accent,
  glowLeft,
  artworkUri,
}) => {
  const { theme } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const overlayColors = getNowPlayingBackdropOverlayColors(theme.appearance);
  const incoming = useMemo(
    () => buildSnapshot({ gradientColors, accent, glowLeft, artworkUri }),
    [accent, artworkUri, glowLeft, gradientColors],
  );
  const { active, outgoing, transition } = useColorCrossfade(incoming, incoming.key, reduceMotion ? 0 : 1000, 0,
    { maxOutgoingLayers: 2, mergeLayers: mergeBackdropLayers });

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
  coverBackdrop: { ...StyleSheet.absoluteFill, opacity: 0.18, transform: [{ scale: 1.08 }] },
  glowOrb: { position: 'absolute', width: 260, height: 260, borderRadius: 130, top: 150, opacity: 0.14 },
});

export default React.memo(NowPlayingBackdrop);
