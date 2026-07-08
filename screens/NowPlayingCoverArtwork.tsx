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
}

const SWIPE_THRESHOLD = 56;
const MOVE_THRESHOLD = 12;
const SWIPE_OUT_DURATION_MS = 150;
const SWIPE_RESET_DURATION_MS = 120;

const getPageX = (event: GestureResponderEvent): number => event.nativeEvent.pageX;

const NowPlayingCoverArtwork: React.FC<NowPlayingCoverArtworkProps> = ({
  song,
  artworkUri,
  isPlaying,
  accent,
  coverSize,
  swipeEnabled = false,
  onSwipeLeft,
  onSwipeRight,
}) => {
  const { theme } = useAppTheme();
  const [coverFailed, setCoverFailed] = React.useState(false);
  const translateX = useRef(new Animated.Value(0)).current;
  const startXRef = useRef(0);

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

    if (!targetHandler) {
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
  }, [coverSize, onSwipeLeft, onSwipeRight, resetCover, translateX]);

  const handleResponderGrant = useCallback((event: GestureResponderEvent) => {
    startXRef.current = getPageX(event);
  }, []);

  const handleResponderMove = useCallback((event: GestureResponderEvent) => {
    if (!swipeEnabled) return;
    translateX.setValue(getPageX(event) - startXRef.current);
  }, [swipeEnabled, translateX]);

  const handleResponderRelease = useCallback((event: GestureResponderEvent) => {
    if (!swipeEnabled) return;
    finishSwipe(getPageX(event) - startXRef.current);
  }, [finishSwipe, swipeEnabled]);

  const shouldSetResponder = useCallback((event: GestureResponderEvent) => (
    swipeEnabled && Math.abs(getPageX(event) - startXRef.current) > MOVE_THRESHOLD
  ), [swipeEnabled]);

  const responderProps = swipeEnabled
    ? {
        onStartShouldSetResponder: () => true,
        onMoveShouldSetResponder: shouldSetResponder,
        onResponderGrant: handleResponderGrant,
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

export default NowPlayingCoverArtwork;
