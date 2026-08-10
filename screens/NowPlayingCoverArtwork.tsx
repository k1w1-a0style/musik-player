import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, View, type ViewStyle } from 'react-native';
import { PanGestureHandler, State, type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent } from 'react-native-gesture-handler';
import { Disc3 } from 'lucide-react-native';
import type { Song } from '../types/Song';
import { useAppTheme } from '../contexts/AppThemeContext';

interface NowPlayingCoverArtworkProps {
  song?: Song | null;
  artworkUri?: string;
  isPlaying: boolean;
  accent: string;
  coverSize: number;
  swipeEnabled?: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  canSwipeLeft?: boolean;
  canSwipeRight?: boolean;
}

const SWIPE_THRESHOLD = 36;
const GESTURE_ACTIVATION_OFFSET = 12;
const VERTICAL_CANCEL_RATIO = 1.15;
const SWIPE_OUT_DURATION_MS = 150;
const SWIPE_RESET_DURATION_MS = 120;

interface CoverSwipeMotionOptions {
  coverSize: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  canSwipeLeft: boolean;
  canSwipeRight: boolean;
}

const useCoverSwipeMotion = ({ coverSize, onSwipeLeft, onSwipeRight,
  canSwipeLeft, canSwipeRight }: CoverSwipeMotionOptions) => {
  const translateX = useRef(new Animated.Value(0)).current;
  useEffect(() => () => translateX.stopAnimation(), [translateX]);
  const resetCover = useCallback(() => {
    Animated.spring(translateX, { toValue: 0, tension: 150, friction: 22,
      useNativeDriver: true }).start();
  }, [translateX]);
  const finishSwipe = useCallback((dx: number) => {
    const swipesLeft = dx <= -SWIPE_THRESHOLD;
    const swipesRight = dx >= SWIPE_THRESHOLD;
    const targetHandler = swipesLeft ? onSwipeLeft : swipesRight ? onSwipeRight : undefined;
    const swipeAllowed = swipesLeft ? canSwipeLeft : swipesRight && canSwipeRight;
    if (!targetHandler || !swipeAllowed) return resetCover();

    Animated.timing(translateX, { toValue: swipesLeft ? -coverSize : coverSize,
      duration: SWIPE_OUT_DURATION_MS, useNativeDriver: true }).start(({ finished }) => {
      if (!finished) return resetCover();
      targetHandler();
      translateX.setValue(swipesLeft ? coverSize : -coverSize);
      Animated.timing(translateX, { toValue: 0, duration: SWIPE_RESET_DURATION_MS,
        useNativeDriver: true }).start();
    });
  }, [canSwipeLeft, canSwipeRight, coverSize, onSwipeLeft, onSwipeRight, resetCover, translateX]);
  const onGestureEvent = useMemo(() => Animated.event<PanGestureHandlerGestureEvent>(
    [{ nativeEvent: { translationX: translateX } }], { useNativeDriver: true }), [translateX]);
  const onStateChange = useCallback((event: PanGestureHandlerStateChangeEvent) => {
    const { oldState, state, translationX: finalX = 0, translationY: finalY = 0 } = event.nativeEvent;
    if (oldState === State.ACTIVE) {
      if (Math.abs(finalY) > Math.abs(finalX) * VERTICAL_CANCEL_RATIO) resetCover();
      else finishSwipe(finalX);
    } else if (state === State.CANCELLED || state === State.FAILED) resetCover();
  }, [finishSwipe, resetCover]);
  const constrainedX = useMemo(() => translateX.interpolate({
    inputRange: [-coverSize, 0, coverSize],
    outputRange: [canSwipeLeft ? -coverSize : -coverSize * 0.12, 0,
      canSwipeRight ? coverSize : coverSize * 0.12],
    extrapolate: 'clamp',
  }), [canSwipeLeft, canSwipeRight, coverSize, translateX]);
  const animatedStyle = useMemo(
    () => ({ transform: [{ translateX: constrainedX }] }) as unknown as ViewStyle,
    [constrainedX],
  );
  return { animatedStyle, onGestureEvent, onStateChange };
};

const NowPlayingCoverArtwork: React.FC<NowPlayingCoverArtworkProps> = ({ song, artworkUri,
  isPlaying, accent, coverSize, swipeEnabled = false, onSwipeLeft, onSwipeRight,
  canSwipeLeft = true, canSwipeRight = true }) => {
  const { theme } = useAppTheme();
  const [coverFailed, setCoverFailed] = useState(false);
  const artworkSource = useMemo(() => artworkUri ? { uri: artworkUri } : null, [artworkUri]);
  const motion = useCoverSwipeMotion({ coverSize, onSwipeLeft, onSwipeRight,
    canSwipeLeft, canSwipeRight });

  useEffect(() => setCoverFailed(false), [song?.id, artworkUri]);

  const cover = (
    <Animated.View style={[styles.coverCard, { width: coverSize, height: coverSize,
      shadowColor: accent, backgroundColor: theme.palette.surface }, motion.animatedStyle]}
      testID="now-playing-cover-card">
      {artworkSource && !coverFailed ? (
        <Image source={artworkSource} style={styles.coverImage} onError={() => setCoverFailed(true)}
          resizeMode="cover" resizeMethod="resize" fadeDuration={0} accessible={false}
          testID="now-playing-cover-image" />
      ) : (
        <View style={[styles.discFallback, isPlaying && styles.discFallbackPlaying]}
          testID="now-playing-cover-fallback">
          <Disc3 color={theme.palette.primary} size={Math.floor(coverSize * 0.55)} />
        </View>
      )}
    </Animated.View>
  );

  if (!swipeEnabled) return cover;
  return (
    <PanGestureHandler testID="now-playing-cover-swipe-gesture"
      activeOffsetX={[-GESTURE_ACTIVATION_OFFSET, GESTURE_ACTIVATION_OFFSET]}
      failOffsetY={[-GESTURE_ACTIVATION_OFFSET, GESTURE_ACTIVATION_OFFSET]}
      onGestureEvent={motion.onGestureEvent} onHandlerStateChange={motion.onStateChange}>
      {cover}
    </PanGestureHandler>
  );
};

const styles = StyleSheet.create({
  coverCard: { borderRadius: 22, overflow: 'hidden', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22, shadowRadius: 16, elevation: 10 },
  coverImage: { width: '100%', height: '100%' },
  discFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  discFallbackPlaying: { opacity: 0.95, transform: [{ scale: 1.02 }] },
});

export default React.memo(NowPlayingCoverArtwork);
