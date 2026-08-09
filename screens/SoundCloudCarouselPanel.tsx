import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import type { Song } from '../types/Song';
import { SOUNDCLOUD_PLAYER_COLORS } from '../utils/appThemeOverlays';
import { getSongArtworkUri } from '../utils/songArtwork';
import type { SoundCloudCarouselPageRole, SoundCloudCarouselRenderPage } from './soundCloudCarouselTypes';

interface ArtworkMotionOptions {
  role: SoundCloudCarouselPageRole;
  isPlaying: boolean;
  panelWidth: number;
  horizontalDrag: Animated.Value;
}

const useArtworkMotion = ({ role, isPlaying, panelWidth, horizontalDrag }: ArtworkMotionOptions) => {
  const drift = useRef(new Animated.Value(0)).current;
  const paused = useRef(new Animated.Value(isPlaying ? 0 : 1)).current;
  useEffect(() => {
    Animated.timing(paused, { toValue: isPlaying ? 0 : 1, duration: 220,
      easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [isPlaying, paused]);
  useEffect(() => {
    if (role !== 'current' || !isPlaying) {
      drift.stopAnimation();
      Animated.timing(drift, { toValue: 0, duration: 220, useNativeDriver: true }).start();
      return undefined;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(drift, { toValue: -1, duration: 18000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(drift, { toValue: 0, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [drift, isPlaying, role]);
  const swipe = useMemo(() => horizontalDrag.interpolate({ inputRange: [-panelWidth, 0, panelWidth],
    outputRange: [panelWidth * 0.08, 0, -panelWidth * 0.08], extrapolate: 'clamp' }), [horizontalDrag, panelWidth]);
  const driftX = useMemo(() => drift.interpolate({ inputRange: [-1, 1],
    outputRange: [-panelWidth * 0.03, panelWidth * 0.03] }), [drift, panelWidth]);
  const scale = useMemo(() => paused.interpolate({ inputRange: [0, 1],
    outputRange: [1.08, 1.12] }), [paused]);
  return { translateX: Animated.add(swipe, driftX), scale };
};

interface SoundCloudCarouselPanelProps {
  song: Song | null;
  role: SoundCloudCarouselPageRole;
  artworkUri?: string;
  fallbackArtworkUri?: string;
  panelWidth: number;
  horizontalDrag: Animated.Value;
  isPlaying: boolean;
  renderPage: SoundCloudCarouselRenderPage;
}

const SoundCloudCarouselPanel = ({ song, role, artworkUri, fallbackArtworkUri, panelWidth,
  horizontalDrag, isPlaying, renderPage }: SoundCloudCarouselPanelProps) => {
  const resolvedArtworkUri = artworkUri ?? getSongArtworkUri(song) ?? fallbackArtworkUri;
  const motion = useArtworkMotion({ role, isPlaying, panelWidth, horizontalDrag });
  return (
    <View style={styles.panel} testID={`soundcloud-carousel-${role}-panel`}>
      {resolvedArtworkUri ? <Animated.Image source={{ uri: resolvedArtworkUri }} resizeMode="cover"
        style={[styles.panelArtwork, { transform: [{ translateX: motion.translateX }, { scale: motion.scale }] }]}
        testID={`soundcloud-carousel-${role}-artwork`} />
        : <View style={[StyleSheet.absoluteFill, styles.emptyArtwork]} />}
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
