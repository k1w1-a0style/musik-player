import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  ImageBackground,
  PanResponder,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type PanResponderGestureState,
} from 'react-native';
import type { Song } from '../types/Song';
import { useAppTheme } from '../contexts/AppThemeContext';
import { APP_THEME_TOKENS } from '../utils/appTheme';
import { displayArtist, displayTitle } from '../utils/libraryPresentation';
import { getSongArtworkUri } from '../utils/songArtwork';
import { getNowPlayingSoundCloudOverlayColors } from '../utils/appThemeOverlays';

export interface SoundCloudTrackCarouselProps {
  currentSong: Song | null;
  previousSong?: Song | null;
  nextSong?: Song | null;
  currentArtworkUri?: string;
  previousArtworkUri?: string;
  nextArtworkUri?: string;
  canSwipeToNext?: boolean;
  onSwipeToNext: () => void;
  onSwipeToPrevious: () => void;
  blurRadius?: number;
  children: React.ReactNode;
}

const MIN_HORIZONTAL_ACTIVATION = 18;
const HORIZONTAL_DOMINANCE = 1.15;
const DISTANCE_COMMIT_RATIO = 0.3;
const VELOCITY_COMMIT = 0.8;
const SPRING_CONFIG = { tension: 150, friction: 22, useNativeDriver: true };
const TIMING_CONFIG = { duration: 150, useNativeDriver: true };
const SWITCH_FALLBACK_RESET_DELAY_MS = 250;

const isHorizontalGesture = (gesture: PanResponderGestureState): boolean => {
  const absDx = Math.abs(gesture.dx);
  const absDy = Math.abs(gesture.dy);
  return absDx >= MIN_HORIZONTAL_ACTIVATION && absDx > absDy * HORIZONTAL_DOMINANCE;
};

interface PanelProps {
  song: Song | null | undefined;
  artworkUri?: string;
  fallbackArtworkUri?: string;
  blurRadius?: number;
  testID: string;
}

const CarouselPanel: React.FC<PanelProps> = ({ song, artworkUri, fallbackArtworkUri, blurRadius = 0, testID }) => {
  const { appearance } = useAppTheme();
  const overlayColors = getNowPlayingSoundCloudOverlayColors(appearance);
  const resolvedArtworkUri = artworkUri ?? getSongArtworkUri(song) ?? fallbackArtworkUri;
  const content = (
    <View style={[styles.panelScrim, { backgroundColor: overlayColors.carouselScrimColor }]}> 
      {song ? (
        <View style={styles.panelMetadata}>
          <Text style={[styles.panelTitle, { color: overlayColors.carouselTitleColor, textShadowColor: overlayColors.carouselTextShadowColor }]} numberOfLines={2}>{displayTitle(song)}</Text>
          <Text style={[styles.panelArtist, { color: overlayColors.carouselArtistColor, textShadowColor: overlayColors.carouselTextShadowColor }]} numberOfLines={1}>{displayArtist(song)}</Text>
        </View>
      ) : null}
    </View>
  );

  if (!resolvedArtworkUri) return <View testID={testID} style={[styles.panel, styles.emptyPanel]}>{content}</View>;

  return (
    <ImageBackground testID={testID} source={{ uri: resolvedArtworkUri }} resizeMode="cover" style={styles.panel} imageStyle={styles.panelImage} blurRadius={blurRadius}>
      {content}
    </ImageBackground>
  );
};

const SoundCloudTrackCarousel: React.FC<SoundCloudTrackCarouselProps> = ({
  currentSong,
  previousSong,
  nextSong,
  currentArtworkUri,
  previousArtworkUri,
  nextArtworkUri,
  canSwipeToNext = true,
  onSwipeToNext,
  onSwipeToPrevious,
  blurRadius = 0,
  children,
}) => {
  const { width } = useWindowDimensions();
  const translateX = useRef(new Animated.Value(0)).current;
  const isSwitchingRef = useRef(false);
  const currentSongIdRef = useRef(currentSong?.id);
  const fallbackResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelWidth = Math.max(width, 1);
  const hasPrevious = !!previousSong;
  const hasNext = !!nextSong && canSwipeToNext;

  currentSongIdRef.current = currentSong?.id;

  const clearFallbackReset = useCallback(() => {
    if (fallbackResetTimeoutRef.current) {
      clearTimeout(fallbackResetTimeoutRef.current);
      fallbackResetTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    clearFallbackReset();
    translateX.stopAnimation();
    translateX.setValue(0);
    isSwitchingRef.current = false;
  }, [clearFallbackReset, currentSong?.id, nextSong?.id, previousSong?.id, translateX]);

  useEffect(() => () => {
    clearFallbackReset();
  }, [clearFallbackReset]);

  const animateBack = useCallback(() => {
    clearFallbackReset();
    Animated.spring(translateX, { ...SPRING_CONFIG, toValue: 0 }).start(() => {
      isSwitchingRef.current = false;
    });
  }, [clearFallbackReset, translateX]);

  const scheduleFallbackReset = useCallback((swipedFromSongId?: string) => {
    clearFallbackReset();
    fallbackResetTimeoutRef.current = setTimeout(() => {
      fallbackResetTimeoutRef.current = null;
      if (isSwitchingRef.current && currentSongIdRef.current === swipedFromSongId) {
        animateBack();
      }
    }, SWITCH_FALLBACK_RESET_DELAY_MS);
  }, [animateBack, clearFallbackReset]);

  const completeSwipe = useCallback((direction: 'next' | 'previous') => {
    isSwitchingRef.current = true;
    const toValue = direction === 'next' ? -panelWidth : panelWidth;
    Animated.timing(translateX, { ...TIMING_CONFIG, toValue }).start(({ finished }) => {
      if (!finished) {
        animateBack();
        return;
      }
      const swipedFromSongId = currentSongIdRef.current;
      if (direction === 'next') onSwipeToNext();
      else onSwipeToPrevious();
      scheduleFallbackReset(swipedFromSongId);
    });
  }, [animateBack, onSwipeToNext, onSwipeToPrevious, panelWidth, scheduleFallbackReset, translateX]);

  const finishGesture = useCallback((gesture: PanResponderGestureState) => {
    if (isSwitchingRef.current) return;
    const wantsNext = gesture.dx < 0;
    const allowed = wantsNext ? hasNext : hasPrevious;
    const passesDistance = Math.abs(gesture.dx) >= panelWidth * DISTANCE_COMMIT_RATIO;
    const passesVelocity = Math.abs(gesture.vx) >= VELOCITY_COMMIT;

    if (allowed && (passesDistance || passesVelocity) && isHorizontalGesture(gesture)) {
      completeSwipe(wantsNext ? 'next' : 'previous');
      return;
    }

    animateBack();
  }, [animateBack, completeSwipe, hasNext, hasPrevious, panelWidth]);

  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => !isSwitchingRef.current && isHorizontalGesture(gesture),
    onMoveShouldSetPanResponderCapture: () => false,
    onPanResponderMove: (_event, gesture) => {
      if (isSwitchingRef.current) return;
      const blockedNext = gesture.dx < 0 && !hasNext;
      const blockedPrevious = gesture.dx > 0 && !hasPrevious;
      translateX.setValue(blockedNext || blockedPrevious ? gesture.dx * 0.22 : gesture.dx);
    },
    onPanResponderRelease: (_event, gesture) => finishGesture(gesture),
    onPanResponderTerminate: (_event, gesture) => finishGesture(gesture),
    onPanResponderTerminationRequest: () => false,
  }), [finishGesture, hasNext, hasPrevious, translateX]);

  return (
    <View testID="soundcloud-track-carousel-root" style={styles.root}>
      <Animated.View testID="soundcloud-track-carousel" style={[styles.track, { width: panelWidth * 3, transform: [{ translateX: Animated.add(translateX, -panelWidth) }] }]} {...responder.panHandlers}>
        <View style={{ width: panelWidth }}>
          <CarouselPanel testID="soundcloud-carousel-previous-panel" song={previousSong} artworkUri={previousArtworkUri} blurRadius={blurRadius} />
        </View>
        <View style={{ width: panelWidth }}>
          <CarouselPanel testID="soundcloud-carousel-current-panel" song={currentSong} artworkUri={currentArtworkUri} blurRadius={blurRadius} />
        </View>
        <View style={{ width: panelWidth }}>
          <CarouselPanel testID="soundcloud-carousel-next-panel" song={nextSong} artworkUri={nextArtworkUri} fallbackArtworkUri={currentArtworkUri} blurRadius={blurRadius} />
        </View>
      </Animated.View>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  track: { flex: 1, flexDirection: 'row' },
  panel: { flex: 1 },
  panelImage: { opacity: 0.98 },
  emptyPanel: {},
  panelScrim: { flex: 1, justifyContent: 'flex-end', padding: APP_THEME_TOKENS.spacing.lg },
  panelMetadata: { alignItems: 'flex-start', marginBottom: APP_THEME_TOKENS.spacing.xl },
  panelTitle: { fontSize: 24, lineHeight: 30, fontFamily: APP_THEME_TOKENS.fonts.heading, textShadowRadius: 8 },
  panelArtist: { fontSize: 18, fontFamily: APP_THEME_TOKENS.fonts.body, textShadowRadius: 8 },
});

export default SoundCloudTrackCarousel;