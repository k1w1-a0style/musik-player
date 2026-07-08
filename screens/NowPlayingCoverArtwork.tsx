import React, { useMemo, useRef } from 'react';
import { Animated, Image, PanResponder, StyleSheet, View } from 'react-native';
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
const SWIPE_OUT_DURATION_MS = 150;
const SWIPE_RESET_DURATION_MS = 120;

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

  React.useEffect(() => setCoverFailed(false), [song?.id, artworkUri]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => (
      swipeEnabled
      && Math.abs(gestureState.dx) > 12
      && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.4
    ),
    onPanResponderMove: (_, gestureState) => {
      translateX.setValue(gestureState.dx);
    },
    onPanResponderRelease: (_, gestureState) => {
      const targetHandler = gestureState.dx <= -SWIPE_THRESHOLD
        ? onSwipeLeft
        : gestureState.dx >= SWIPE_THRESHOLD
          ? onSwipeRight
          : undefined;

      if (!targetHandler) {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
        return;
      }

      Animated.timing(translateX, {
        toValue: gestureState.dx < 0 ? -coverSize : coverSize,
        duration: SWIPE_OUT_DURATION_MS,
        useNativeDriver: true,
      }).start(() => {
        targetHandler();
        translateX.setValue(gestureState.dx < 0 ? coverSize : -coverSize);
        Animated.timing(translateX, {
          toValue: 0,
          duration: SWIPE_RESET_DURATION_MS,
          useNativeDriver: true,
        }).start();
      });
    },
    onPanResponderTerminate: () => {
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    },
  }), [coverSize, onSwipeLeft, onSwipeRight, swipeEnabled, translateX]);

  return (
    <Animated.View
      {...(swipeEnabled ? panResponder.panHandlers : {})}
      style={[
        styles.coverCard,
        {
          width: coverSize,
          height: coverSize,
          shadowColor: accent,
          backgroundColor: theme.palette.surface,
          transform: [{ translateX }],
        },
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
