import React, { useCallback, useMemo, useState } from 'react';
import { Animated, StyleSheet, View, useWindowDimensions } from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { useHorizontalTrackMotion, useVerticalPlayerMotion } from '../hooks/useSoundCloudCarouselMotion';
import type { Song } from '../types/Song';
import { getTrackPageKeys } from '../utils/soundCloudPlayer';
import SoundCloudCarouselPanel from './SoundCloudCarouselPanel';
import type { SoundCloudCarouselRenderPage } from './soundCloudCarouselTypes';

export type { SoundCloudCarouselPageRole } from './soundCloudCarouselTypes';

export interface SoundCloudTrackCarouselProps {
  currentSong: Song | null;
  previousSong?: Song | null;
  nextSong?: Song | null;
  currentArtworkUri?: string;
  previousArtworkUri?: string;
  nextArtworkUri?: string;
  isPlaying: boolean;
  topInset: number;
  bottomInset: number;
  canSwipeToNext?: boolean;
  onSwipeToNext: () => void;
  onSwipeToPrevious: () => void;
  onCollapse: () => void;
  onOpenQueue: () => void;
  onQueuePreviewStart?: () => void;
  onQueuePreviewEnd?: () => void;
  verticalDrag: Animated.Value;
  verticalGestureEnabled?: boolean;
  renderPage: SoundCloudCarouselRenderPage;
  chrome?: React.ReactNode;
  waveformGestureRef?: React.RefObject<unknown | null>;
  reduceMotion?: boolean;
}

const hasNextTrack = (song: Song | null | undefined, allowed: boolean): boolean => Boolean(song) && allowed;
const nullableSong = (song: Song | null | undefined): Song | null => song || null;

interface TrackTransitionSnapshot {
  currentSong: Song | null;
  previousSong: Song | null;
  nextSong: Song | null;
  currentArtworkUri?: string;
  previousArtworkUri?: string;
  nextArtworkUri?: string;
}

const getPageAvailability = (snapshot: TrackTransitionSnapshot | null, previousSong: Song | null | undefined,
  nextSong: Song | null | undefined, canSwipeToNext: boolean) => ({
  hasPrevious: Boolean(snapshot ? snapshot.previousSong : previousSong),
  hasNext: snapshot ? Boolean(snapshot.nextSong) : hasNextTrack(nextSong, canSwipeToNext),
});

const CarouselChrome = ({ children }: { children?: React.ReactNode }) => {
  if (!children) return null;
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>{children}</View>;
};

const SoundCloudTrackCarousel: React.FC<SoundCloudTrackCarouselProps> = ({ currentSong, previousSong,
  nextSong, currentArtworkUri, previousArtworkUri, nextArtworkUri, canSwipeToNext = true,
  isPlaying, topInset, bottomInset, onSwipeToNext, onSwipeToPrevious, onCollapse, onOpenQueue,
  onQueuePreviewStart, onQueuePreviewEnd, verticalDrag, verticalGestureEnabled = true,
  renderPage, chrome, waveformGestureRef,
  reduceMotion = false,
}) => {
  const { width, height } = useWindowDimensions();
  const panelWidth = Math.max(1, width);
  const [transitionSnapshot, setTransitionSnapshot] = useState<TrackTransitionSnapshot | null>(null);
  const holdTransitionPages = useCallback(() => setTransitionSnapshot({
    currentSong,
    previousSong: nullableSong(previousSong),
    nextSong: nullableSong(nextSong),
    currentArtworkUri,
    previousArtworkUri,
    nextArtworkUri,
  }), [currentArtworkUri, currentSong, nextArtworkUri, nextSong,
    previousArtworkUri, previousSong]);
  const releaseTransitionPages = useCallback(() => setTransitionSnapshot(null), []);
  const horizontal = useHorizontalTrackMotion({ currentSongId: currentSong?.id, panelWidth,
    onNext: onSwipeToNext, onPrevious: onSwipeToPrevious,
    ...getPageAvailability(transitionSnapshot, previousSong, nextSong, canSwipeToNext),
    reduceMotion, dispatchBeforeAnimation: true,
    onTransitionStart: holdTransitionPages, onTransitionEnd: releaseTransitionPages });
  const vertical = useVerticalPlayerMotion({ drag: verticalDrag, height: Math.max(1, height),
    onCollapse, onOpenQueue, onQueuePreviewStart, onQueuePreviewEnd, reduceMotion });
  const displayed = transitionSnapshot ?? { currentSong, previousSong: nullableSong(previousSong),
    nextSong: nullableSong(nextSong), currentArtworkUri, previousArtworkUri, nextArtworkUri };
  const pageKeys = getTrackPageKeys({ currentId: displayed.currentSong?.id,
    previousId: displayed.previousSong?.id, nextId: displayed.nextSong?.id });
  const trackTranslateX = useMemo(
    () => Animated.add(horizontal.constrainedDrag, -panelWidth),
    [horizontal.constrainedDrag, panelWidth],
  );
  return (
    <View testID="soundcloud-track-carousel-root" style={styles.root}>
      <PanGestureHandler testID="soundcloud-collapse-gesture" enabled={verticalGestureEnabled}
        activeOffsetY={[-24, 24]}
        failOffsetX={[-18, 18]} onGestureEvent={vertical.onGestureEvent}
        onHandlerStateChange={vertical.onStateChange}>
        <Animated.View style={[styles.player, { opacity: vertical.opacity,
          transform: [{ translateY: vertical.translateY }, { scale: vertical.scale }] }]}
          testID="soundcloud-collapsible-player">
          <PanGestureHandler testID="soundcloud-track-swipe-gesture" enabled={!transitionSnapshot}
            activeOffsetX={[-18, 18]}
            failOffsetY={[-18, 18]} waitFor={waveformGestureRef}
            onGestureEvent={horizontal.onGestureEvent}
            onHandlerStateChange={horizontal.onStateChange}>
            <Animated.View style={styles.carouselViewport} collapsable={false}>
              <Animated.View testID="soundcloud-track-carousel"
                style={[styles.track, { width: panelWidth * 3, left: horizontal.pageOffset,
                  transform: [{ translateX: trackTranslateX }] }]}>
                <View key={pageKeys.previous} style={{ width: panelWidth }}>
                  <SoundCloudCarouselPanel song={displayed.previousSong} role="previous"
                    artworkUri={displayed.previousArtworkUri} paused={!isPlaying}
                    topInset={topInset} bottomInset={bottomInset} />
                </View>
                <View key={pageKeys.current} style={{ width: panelWidth }}>
                  <SoundCloudCarouselPanel song={displayed.currentSong} role="current"
                    artworkUri={displayed.currentArtworkUri} paused={!isPlaying}
                    topInset={topInset} bottomInset={bottomInset} />
                </View>
                <View key={pageKeys.next} style={{ width: panelWidth }}>
                  <SoundCloudCarouselPanel song={displayed.nextSong} role="next"
                    artworkUri={displayed.nextArtworkUri} paused={!isPlaying}
                    topInset={topInset} bottomInset={bottomInset} />
                </View>
              </Animated.View>
              <View style={styles.currentPage} testID="soundcloud-current-page-layer">
                {renderPage({ song: displayed.currentSong, role: 'current' })}
              </View>
            </Animated.View>
          </PanGestureHandler>
          <CarouselChrome>{chrome}</CarouselChrome>
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', backgroundColor: 'transparent' },
  player: { flex: 1, overflow: 'hidden', backgroundColor: 'transparent' },
  carouselViewport: { flex: 1, overflow: 'hidden' },
  track: { flex: 1, flexDirection: 'row' },
  currentPage: { ...StyleSheet.absoluteFillObject },
});

export default React.memo(SoundCloudTrackCarousel);
