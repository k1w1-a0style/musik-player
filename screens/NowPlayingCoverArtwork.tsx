import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { Disc3 } from 'lucide-react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useHorizontalTrackMotion } from '../hooks/useSoundCloudCarouselMotion';
import type { Song } from '../types/Song';

interface NowPlayingCoverArtworkProps {
  song?: Song | null;
  previousSong?: Song | null;
  nextSong?: Song | null;
  artworkUri?: string;
  previousArtworkUri?: string;
  nextArtworkUri?: string;
  isPlaying: boolean;
  accent: string;
  coverSize: number;
  swipeEnabled?: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  canSwipeLeft?: boolean;
  canSwipeRight?: boolean;
}

type CoverRole = 'previous' | 'current' | 'next';

interface CoverCardProps {
  role: CoverRole;
  song?: Song | null;
  artworkUri?: string;
  isPlaying: boolean;
  coverSize: number;
  backgroundColor: string;
  primaryColor: string;
}

const GESTURE_ACTIVATION_OFFSET = 12;
const noop = (): void => undefined;
const isNextPageAvailable = ({ nextSong, canSwipeLeft, onSwipeLeft }:
  Pick<NowPlayingCoverArtworkProps, 'nextSong' | 'canSwipeLeft' | 'onSwipeLeft'>): boolean =>
  Boolean(nextSong && canSwipeLeft && onSwipeLeft);
const isPreviousPageAvailable = ({ previousSong, canSwipeRight, onSwipeRight }:
  Pick<NowPlayingCoverArtworkProps, 'previousSong' | 'canSwipeRight' | 'onSwipeRight'>): boolean =>
  Boolean(previousSong && canSwipeRight && onSwipeRight);

const getCardTestId = (role: CoverRole): string => role === 'current'
  ? 'now-playing-cover-card'
  : `now-playing-cover-${role}-card`;
const getImageTestId = (role: CoverRole): string => role === 'current'
  ? 'now-playing-cover-image'
  : `now-playing-cover-${role}-image`;
const getFallbackTestId = (role: CoverRole): string => role === 'current'
  ? 'now-playing-cover-fallback'
  : `now-playing-cover-${role}-fallback`;

const CoverCard = React.memo(({ role, song, artworkUri, isPlaying, coverSize,
  backgroundColor, primaryColor }: CoverCardProps) => {
  const [coverFailed, setCoverFailed] = useState(false);
  const artworkSource = useMemo(() => artworkUri ? { uri: artworkUri } : null, [artworkUri]);

  useEffect(() => setCoverFailed(false), [artworkUri, song?.id]);

  return (
    <View style={[styles.coverCard, { width: coverSize, height: coverSize, backgroundColor }]}
      testID={getCardTestId(role)}>
      {artworkSource && !coverFailed ? (
        <Image source={artworkSource} style={styles.coverImage} onError={() => setCoverFailed(true)}
          resizeMode="cover" resizeMethod="resize" fadeDuration={0} accessible={false}
          testID={getImageTestId(role)} />
      ) : (
        <View style={[styles.discFallback, isPlaying && styles.discFallbackPlaying]}
          testID={getFallbackTestId(role)}>
          <Disc3 color={primaryColor} size={Math.floor(coverSize * 0.55)} />
        </View>
      )}
    </View>
  );
});

const StaticCoverArtwork = ({ song, artworkUri, isPlaying, accent, coverSize }:
  NowPlayingCoverArtworkProps) => {
  const { theme } = useAppTheme();
  const cardProps = {
    coverSize,
    backgroundColor: theme.palette.surface,
    primaryColor: theme.palette.primary,
  };
  return (
    <View style={[styles.coverShadow, { width: coverSize, height: coverSize,
      shadowColor: accent, backgroundColor: theme.palette.surface }]}>
      <CoverCard role="current" song={song} artworkUri={artworkUri} isPlaying={isPlaying}
        {...cardProps} />
    </View>
  );
};

const ClassicCoverPager = ({ song, previousSong, nextSong, artworkUri, previousArtworkUri,
  nextArtworkUri, isPlaying, accent, coverSize, onSwipeLeft, onSwipeRight,
  canSwipeLeft = true, canSwipeRight = true }: NowPlayingCoverArtworkProps) => {
  const { theme } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const motion = useHorizontalTrackMotion({ currentSongId: song?.id, panelWidth: coverSize,
    onNext: onSwipeLeft ?? noop, onPrevious: onSwipeRight ?? noop,
    hasNext: isNextPageAvailable({ nextSong, canSwipeLeft, onSwipeLeft }),
    hasPrevious: isPreviousPageAvailable({ previousSong, canSwipeRight, onSwipeRight }),
    reduceMotion });
  const trackTranslateX = useMemo(() => Animated.add(motion.constrainedDrag, -coverSize),
    [coverSize, motion.constrainedDrag]);
  const cardProps = { coverSize, backgroundColor: theme.palette.surface,
    primaryColor: theme.palette.primary };
  return (
    <View style={[styles.coverShadow, { width: coverSize, height: coverSize,
      shadowColor: accent, backgroundColor: theme.palette.surface }]}
      testID="now-playing-cover-pager">
      <View style={styles.pagerViewport}>
        <PanGestureHandler testID="now-playing-cover-swipe-gesture"
          activeOffsetX={[-GESTURE_ACTIVATION_OFFSET, GESTURE_ACTIVATION_OFFSET]}
          failOffsetY={[-GESTURE_ACTIVATION_OFFSET, GESTURE_ACTIVATION_OFFSET]}
          onGestureEvent={motion.onGestureEvent} onHandlerStateChange={motion.onStateChange}>
          <Animated.View style={[styles.coverTrack, { width: coverSize * 3,
            transform: [{ translateX: trackTranslateX }] }]} testID="now-playing-cover-track">
            <CoverCard role="previous" song={previousSong} artworkUri={previousArtworkUri}
              isPlaying={false} {...cardProps} />
            <CoverCard role="current" song={song} artworkUri={artworkUri} isPlaying={isPlaying}
              {...cardProps} />
            <CoverCard role="next" song={nextSong} artworkUri={nextArtworkUri}
              isPlaying={false} {...cardProps} />
          </Animated.View>
        </PanGestureHandler>
      </View>
    </View>
  );
};

const NowPlayingCoverArtwork: React.FC<NowPlayingCoverArtworkProps> = props => props.swipeEnabled
  ? <ClassicCoverPager {...props} />
  : <StaticCoverArtwork {...props} />;

const styles = StyleSheet.create({
  coverShadow: {
    borderRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 10,
  },
  pagerViewport: { flex: 1, overflow: 'hidden', borderRadius: 22 },
  coverTrack: { height: '100%', flexDirection: 'row' },
  coverCard: { overflow: 'hidden' },
  coverImage: { width: '100%', height: '100%' },
  discFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  discFallbackPlaying: { opacity: 0.95, transform: [{ scale: 1.02 }] },
});

export default React.memo(NowPlayingCoverArtwork);
