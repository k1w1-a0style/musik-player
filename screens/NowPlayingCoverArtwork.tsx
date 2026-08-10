import React, { useCallback, useMemo, useRef } from 'react';
import { Animated, Image, StyleSheet, View, type GestureResponderEvent, type ViewStyle } from 'react-native';
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
const MOVE_THRESHOLD = 8;
const VERTICAL_CANCEL_RATIO = 1.15;
const SWIPE_OUT_DURATION_MS = 150;
const SWIPE_RESET_DURATION_MS = 120;

const getPageX = (event: GestureResponderEvent): number => event.nativeEvent.pageX;
const getPageY = (event: GestureResponderEvent): number => event.nativeEvent.pageY;

const NowPlayingCoverArtwork: React.FC<NowPlayingCoverArtworkProps> = ({
  song,
  artworkUri,
  isPlaying,
  accent,
  coverSize,
  swipeEnabled = false,
  onSwipeLeft,
  onSwipeRight,
  canSwipeLeft = true,
  canSwipeRight = true,
}) => {
  const { theme } = useAppTheme();
  const [coverFailed, setCoverFailed] = React.useState(false);
  const translateX = useRef(new Animated.Value(0)).current;
  const startXRef = useRef(0);
  const startYRef = useRef(0);

  React.useEffect(() => setCoverFailed(false), [song?.id, artworkUri]);

  const resetCover = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
  }, [translateX]);

  const finishSwipe = useCallback((dx: number) => {
    const targetHandler = dx <= -SWIPE_THRESHOLD
      ? onSwipeLeft
      : dx >= SWIPE_THRESHOLD
        ? onSwipeRight
        : undefined;

    const swipeAllowed = dx <= -SWIPE_THRESHOLD ? canSwipeLeft : canSwipeRight;

    if (!targetHandler || !swipeAllowed) {
      resetCover();
      return;
    }

    Animated.timing(translateX, {
      toValue: dx < 0 ? -coverSize : coverSize,
      duration: SWIPE_OUT_DURATION_MS,
      useNativeDriver: true,
    }).start(() => {
      targetHandler();
      translateX.setValue(dx < 0 ? coverSize : -coverSize);
      Animated.timing(translateX, {
        toValue: 0,
        duration: SWIPE_RESET_DURATION_MS,
        useNativeDriver: true,
      }).start();
    });
  }, [canSwipeLeft, canSwipeRight, coverSize, onSwipeLeft, onSwipeRight, resetCover, translateX]);

  const recordTouchStart = useCallback((event: GestureResponderEvent) => {
    startXRef.current = getPageX(event);
    startYRef.current = getPageY(event);
  }, []);

  const handleResponderMove = useCallback((event: GestureResponderEvent) => {
    if (!swipeEnabled) return;
    const dx = getPageX(event) - startXRef.current;
    const dy = getPageY(event) - startYRef.current;
    if (Math.abs(dy) > Math.abs(dx) * VERTICAL_CANCEL_RATIO) return;
    translateX.setValue(dx);
  }, [swipeEnabled, translateX]);

  const handleResponderRelease = useCallback((event: GestureResponderEvent) => {
    if (!swipeEnabled) return;
    const dx = getPageX(event) - startXRef.current;
    const dy = getPageY(event) - startYRef.current;
    if (Math.abs(dy) > Math.abs(dx) * VERTICAL_CANCEL_RATIO) {
      resetCover();
      return;
    }
    finishSwipe(dx);
  }, [finishSwipe, resetCover, swipeEnabled]);

  const shouldSetResponder = useCallback((event: GestureResponderEvent) => {
    const dx = getPageX(event) - startXRef.current;
    const dy = getPageY(event) - startYRef.current;
    return (
      swipeEnabled
      && Math.abs(dx) > MOVE_THRESHOLD
      && Math.abs(dx) > Math.abs(dy)
    );
  }, [swipeEnabled]);

  const responderProps = swipeEnabled
    ? {
        onStartShouldSetResponder: (event: GestureResponderEvent) => {
          recordTouchStart(event);
          return false;
        },
        onMoveShouldSetResponder: shouldSetResponder,
        onResponderMove: handleResponderMove,
        onResponderRelease: handleResponderRelease,
        onResponderTerminate: resetCover,
      }
    : {};

  const animatedCoverStyle = useMemo(
    () => ({ transform: [{ translateX }] }) as unknown as ViewStyle,
    [translateX],
  );

  return (
    <Animated.View
      {...responderProps}
      style={[
        styles.coverCard,
        {
          width: coverSize,
          height: coverSize,
          shadowColor: accent,
          backgroundColor: theme.palette.surface,
        },
        animatedCoverStyle,
      ]}
      testID="now-playing-cover-card"
    >
      {artworkUri && !coverFailed ? (
        <Image
          source={{ uri: artworkUri }}
          style={styles.coverImage}
          onError={() => setCoverFailed(true)}
          resizeMode="cover"
          testID="now-playing-cover-image"
        />
      ) : (
        <View style={[styles.discFallback, isPlaying && styles.discFallbackPlaying]} testID="now-playing-cover-fallback">
          <Disc3 color={theme.palette.primary} size={Math.floor(coverSize * 0.55)} />
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  coverCard: { borderRadius: 22, overflow: 'hidden', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.22, shadowRadius: 16, elevation: 10 },
  coverImage: { width: '100%', height: '100%' },
  discFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  discFallbackPlaying: { opacity: 0.95, transform: [{ scale: 1.02 }] },
});

export default React.memo(NowPlayingCoverArtwork);
