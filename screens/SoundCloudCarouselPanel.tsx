import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import type { Song } from '../types/Song';
import { SOUNDCLOUD_PLAYER_COLORS } from '../utils/appThemeOverlays';
import { getSongArtworkUri } from '../utils/songArtwork';
import type { SoundCloudCarouselPageRole, SoundCloudCarouselRenderPage } from './soundCloudCarouselTypes';

const PAUSE_TRANSITION_MS = 220;

interface ArtworkMotionOptions {
  role: SoundCloudCarouselPageRole;
  isPlaying: boolean;
  panelWidth: number;
  horizontalDrag: Animated.Value;
  reduceMotion: boolean;
}

const useArtworkMotion = ({ role, isPlaying, panelWidth, horizontalDrag, reduceMotion }: ArtworkMotionOptions) => {
  const isPaused = role === 'current' && !isPlaying;
  const drift = useRef(new Animated.Value(0)).current;
  const paused = useRef(new Animated.Value(isPaused ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) {
      paused.stopAnimation();
      paused.setValue(isPaused ? 1 : 0);
      return;
    }
    Animated.timing(paused, { toValue: isPaused ? 1 : 0, duration: PAUSE_TRANSITION_MS,
      easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [isPaused, paused, reduceMotion]);
  useEffect(() => {
    if (reduceMotion || role !== 'current' || !isPlaying) {
      drift.stopAnimation();
      if (reduceMotion) {
        drift.setValue(0);
        return undefined;
      }
      Animated.timing(drift, { toValue: 0, duration: PAUSE_TRANSITION_MS, useNativeDriver: true }).start();
      return undefined;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.sin),
        useNativeDriver: true, isInteraction: false }),
      Animated.timing(drift, { toValue: -1, duration: 18000, easing: Easing.inOut(Easing.sin),
        useNativeDriver: true, isInteraction: false }),
      Animated.timing(drift, { toValue: 0, duration: 9000, easing: Easing.inOut(Easing.sin),
        useNativeDriver: true, isInteraction: false }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [drift, isPlaying, reduceMotion, role]);
  const swipe = useMemo(() => horizontalDrag.interpolate({ inputRange: [-panelWidth, 0, panelWidth],
    outputRange: [panelWidth * 0.08, 0, -panelWidth * 0.08], extrapolate: 'clamp' }), [horizontalDrag, panelWidth]);
  const driftX = useMemo(() => drift.interpolate({ inputRange: [-1, 1],
    outputRange: [-panelWidth * 0.03, panelWidth * 0.03] }), [drift, panelWidth]);
  const translateX = useMemo(() => Animated.add(swipe, driftX), [driftX, swipe]);
  const scale = useMemo(() => paused.interpolate({ inputRange: [0, 1],
    outputRange: [1.08, 1.12] }), [paused]);
  return { translateX, scale, pauseTransition: paused };
};

interface SoundCloudCarouselPanelProps {
  song: Song | null;
  role: SoundCloudCarouselPageRole;
  artworkUri?: string;
  panelWidth: number;
  horizontalDrag: Animated.Value;
  isPlaying: boolean;
  reduceMotion?: boolean;
  renderPage: SoundCloudCarouselRenderPage;
}

const SoundCloudCarouselPanel = ({ song, role, artworkUri, panelWidth,
  horizontalDrag, isPlaying, reduceMotion = false, renderPage }: SoundCloudCarouselPanelProps) => {
  const resolvedArtworkUri = artworkUri ?? getSongArtworkUri(song);
  const artworkSource = useMemo(
    () => resolvedArtworkUri ? { uri: resolvedArtworkUri } : null,
    [resolvedArtworkUri],
  );
  const isPaused = role === 'current' && !isPlaying && artworkSource !== null;
  const [renderPausedArtwork, setRenderPausedArtwork] = useState(isPaused);
  const showPausedArtwork = isPaused || (!reduceMotion && renderPausedArtwork);
  const motion = useArtworkMotion({ role, isPlaying, panelWidth, horizontalDrag, reduceMotion });

  useEffect(() => {
    if (isPaused) {
      setRenderPausedArtwork(true);
      return undefined;
    }
    if (reduceMotion) {
      setRenderPausedArtwork(false);
      return undefined;
    }
    if (!renderPausedArtwork) return undefined;
    const timer = setTimeout(() => setRenderPausedArtwork(false), PAUSE_TRANSITION_MS + 40);
    return () => clearTimeout(timer);
  }, [isPaused, reduceMotion, renderPausedArtwork]);

  return (
    <View style={styles.panel} testID={`soundcloud-carousel-${role}-panel`}
      accessibilityElementsHidden={role !== 'current'}
      importantForAccessibility={role === 'current' ? 'auto' : 'no-hide-descendants'}>
      {artworkSource ? <Animated.Image source={artworkSource} resizeMode="cover"
        resizeMethod="resize" fadeDuration={0} accessible={false}
        style={[styles.panelArtwork, { transform: [{ translateX: motion.translateX }, { scale: motion.scale }] }]}
        testID={`soundcloud-carousel-${role}-artwork`} />
        : <View style={[StyleSheet.absoluteFill, styles.emptyArtwork]} />}
      {showPausedArtwork && artworkSource ? <Animated.Image source={artworkSource}
        resizeMode="cover" resizeMethod="resize" fadeDuration={0} blurRadius={18} accessible={false}
        style={[styles.panelArtwork, { opacity: motion.pauseTransition,
          transform: [{ translateX: motion.translateX }, { scale: motion.scale }] }]}
        testID="soundcloud-carousel-current-paused-artwork" /> : null}
      <View pointerEvents="none" style={styles.artworkShade} />
      {renderPage({ song, role })}
    </View>
  );
};

const styles = StyleSheet.create({
  panel: { flex: 1, overflow: 'hidden', backgroundColor: SOUNDCLOUD_PLAYER_COLORS.artworkBackground },
  panelArtwork: { ...StyleSheet.absoluteFillObject },
  emptyArtwork: { backgroundColor: SOUNDCLOUD_PLAYER_COLORS.artworkFallback },
  artworkShade: { ...StyleSheet.absoluteFillObject, backgroundColor: SOUNDCLOUD_PLAYER_COLORS.artworkShade },
});

export default React.memo(SoundCloudCarouselPanel);
