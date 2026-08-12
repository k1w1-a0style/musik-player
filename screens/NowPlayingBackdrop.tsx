import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import type { ColorValue, ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { getNowPlayingBackdropOverlayColors } from '../utils/appThemeOverlays';

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

const BACKDROP_CROSSFADE_MS = 680;

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
  opacity: number | Animated.AnimatedInterpolation<number>;
  artworkTestId: string;
}) => (
  <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
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
  paletteLoading = false,
}) => {
  const { theme } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const overlayColors = getNowPlayingBackdropOverlayColors(theme.appearance);
  const incoming = useMemo(
    () => buildSnapshot({ gradientColors, accent, glowLeft, artworkUri }),
    [accent, artworkUri, glowLeft, gradientColors],
  );
  const [active, setActive] = useState(incoming);
  const [outgoing, setOutgoing] = useState<BackdropSnapshot | null>(null);
  const transition = useRef(new Animated.Value(1)).current;
  const transitionGeneration = useRef(0);

  useEffect(() => {
    if (incoming.key === active.key) return;
    if (paletteLoading) return;
    if (outgoing && !reduceMotion) return;
    transitionGeneration.current += 1;
    const generation = transitionGeneration.current;
    transition.stopAnimation();
    setActive(incoming);
    if (reduceMotion) {
      transition.setValue(1);
      setOutgoing(null);
      return;
    }
    setOutgoing(active);
    transition.setValue(0);
    Animated.timing(transition, {
      toValue: 1,
      duration: BACKDROP_CROSSFADE_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && transitionGeneration.current === generation) setOutgoing(null);
    });
  }, [active, incoming, outgoing, paletteLoading, reduceMotion, transition]);

  useEffect(() => () => transition.stopAnimation(), [transition]);

  const outgoingOpacity = useMemo(() => Animated.subtract(1, transition), [transition]);

  return (
    <>
      {outgoing ? (
        <BackdropLayer snapshot={outgoing} opacity={outgoingOpacity}
          artworkTestId="now-playing-cover-backdrop-outgoing" />
      ) : null}
      <BackdropLayer snapshot={active} opacity={outgoing ? transition : 1}
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
