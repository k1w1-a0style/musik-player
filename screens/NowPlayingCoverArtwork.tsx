import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useHorizontalTrackMotion } from '../hooks/useSoundCloudCarouselMotion';
import type { Song } from '../types/Song';
import { getTrackPageKeys } from '../utils/soundCloudPlayer';
import { KIWI_MUSIC_ARTWORK, getSongArtworkUri } from '../utils/songArtwork';
import CoverPagerTrack from '../components/CoverPagerTrack';

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

interface CoverTransitionSnapshot {
  song: Song | null;
  previousSong: Song | null;
  nextSong: Song | null;
  artworkUri?: string;
  previousArtworkUri?: string;
  nextArtworkUri?: string;
}

interface CoverCardProps {
  role: CoverRole;
  song?: Song | null;
  artworkUri?: string;
  isPlaying: boolean;
  coverSize: number;
  backgroundColor: string;
}

const GESTURE_ACTIVATION_OFFSET = 12;
const noop = (): void => undefined;
const nullableSong = (song: Song | null | undefined): Song | null => song ?? null;
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
  backgroundColor }: CoverCardProps) => {
  const [coverFailed, setCoverFailed] = useState(false);
  const resolvedArtworkUri = artworkUri ?? getSongArtworkUri(song);
  const artworkSource = useMemo(() => resolvedArtworkUri ? { uri: resolvedArtworkUri } : null, [resolvedArtworkUri]);

  useEffect(() => setCoverFailed(false), [resolvedArtworkUri, song?.id]);

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
          <Image source={KIWI_MUSIC_ARTWORK} style={styles.coverImage} resizeMode="cover"
            resizeMethod="resize" fadeDuration={0} accessible={false} />
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
  };
  return (
    <View style={[styles.coverShadow, { width: coverSize, height: coverSize,
      shadowColor: accent, backgroundColor: theme.palette.surface }]}>
      <CoverCard role="current" song={song} artworkUri={artworkUri} isPlaying={isPlaying}
        {...cardProps} />
    </View>
  );
};

const CoverPage = ({ pageWidth, accent, ...props }: CoverCardProps & {
  pageWidth: number; accent: string;
}) => (
  <View style={[styles.coverPage, { width: pageWidth }]}
    testID={`now-playing-cover-${props.role}-page`}>
    {props.song || props.role === 'current' ? (
      <View style={[styles.coverShadow, { width: props.coverSize, height: props.coverSize,
        shadowColor: accent, backgroundColor: props.backgroundColor }]}>
        <CoverCard {...props} />
      </View>
    ) : null}
  </View>
);

const ClassicCoverPager = ({ song, previousSong, nextSong, artworkUri, previousArtworkUri,
  nextArtworkUri, isPlaying, accent, coverSize, onSwipeLeft, onSwipeRight,
  canSwipeLeft = true, canSwipeRight = true }: NowPlayingCoverArtworkProps) => {
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const pageWidth = Math.max(coverSize + 32, width);
  const reduceMotion = useReducedMotion();
  const [transitionSnapshot, setTransitionSnapshot] = useState<CoverTransitionSnapshot | null>(null);
  const holdTransitionPages = React.useCallback(() => setTransitionSnapshot({
    song: nullableSong(song),
    previousSong: nullableSong(previousSong),
    nextSong: nullableSong(nextSong),
    artworkUri,
    previousArtworkUri,
    nextArtworkUri,
  }), [artworkUri, nextArtworkUri, nextSong, previousArtworkUri, previousSong, song]);
  const releaseTransitionPages = React.useCallback(() => setTransitionSnapshot(null), []);
  const motion = useHorizontalTrackMotion({ currentSongId: song?.id, panelWidth: pageWidth,
    onNext: onSwipeLeft ?? noop, onPrevious: onSwipeRight ?? noop,
    hasNext: transitionSnapshot ? Boolean(transitionSnapshot.nextSong)
      : isNextPageAvailable({ nextSong, canSwipeLeft, onSwipeLeft }),
    hasPrevious: transitionSnapshot ? Boolean(transitionSnapshot.previousSong)
      : isPreviousPageAvailable({ previousSong, canSwipeRight, onSwipeRight }),
    reduceMotion, transitionDurationMs: 360, dispatchBeforeAnimation: true, onTransitionStart: holdTransitionPages,
    onTransitionEnd: releaseTransitionPages });
  const displayed = transitionSnapshot ?? {
    song: nullableSong(song),
    previousSong: nullableSong(previousSong),
    nextSong: nullableSong(nextSong),
    artworkUri,
    previousArtworkUri,
    nextArtworkUri,
  };
  const trackTranslateX = useMemo(() => Animated.add(motion.constrainedDrag, -pageWidth),
    [pageWidth, motion.constrainedDrag]);
  const pageKeys = getTrackPageKeys({ currentId: displayed.song?.id,
    previousId: displayed.previousSong?.id, nextId: displayed.nextSong?.id });
  const cardProps = { coverSize, pageWidth, accent, backgroundColor: theme.palette.surface };
  return (
    <View style={[styles.pagerViewport, { width: pageWidth, height: coverSize + 32 }]}
      testID="now-playing-cover-pager">
        <PanGestureHandler testID="now-playing-cover-swipe-gesture" enabled={!transitionSnapshot}
          activeOffsetX={[-GESTURE_ACTIVATION_OFFSET, GESTURE_ACTIVATION_OFFSET]}
          failOffsetY={[-GESTURE_ACTIVATION_OFFSET, GESTURE_ACTIVATION_OFFSET]}
          onGestureEvent={motion.onGestureEvent} onHandlerStateChange={motion.onStateChange}>
          <Animated.View style={styles.gestureViewport} collapsable={false}>
          <CoverPagerTrack style={styles.coverTrack} width={pageWidth * 3} pageOffset={motion.pageOffset}
            translateX={trackTranslateX} testID="now-playing-cover-track">
            <CoverPage key={pageKeys.previous}
              role="previous" song={displayed.previousSong}
              artworkUri={displayed.previousArtworkUri}
              isPlaying={false} {...cardProps} />
            <CoverPage key={pageKeys.current}
              role="current" song={displayed.song} artworkUri={displayed.artworkUri}
              isPlaying={isPlaying}
              {...cardProps} />
            <CoverPage key={pageKeys.next}
              role="next" song={displayed.nextSong} artworkUri={displayed.nextArtworkUri}
              isPlaying={false} {...cardProps} />
          </CoverPagerTrack>
          </Animated.View>
        </PanGestureHandler>
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
  pagerViewport: { overflow: 'hidden' },
  gestureViewport: { width: '100%', height: '100%' },
  coverPage: { alignItems: 'center', justifyContent: 'center' },
  coverTrack: { height: '100%', flexDirection: 'row' },
  coverCard: { overflow: 'hidden', borderRadius: 22 },
  coverImage: { width: '100%', height: '100%' },
  discFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  discFallbackPlaying: { opacity: 0.95, transform: [{ scale: 1.02 }] },
});

export default React.memo(NowPlayingCoverArtwork);
