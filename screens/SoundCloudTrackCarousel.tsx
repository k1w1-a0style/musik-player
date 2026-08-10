import React, { useMemo } from 'react';
import { Animated, StyleSheet, View, useWindowDimensions } from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { useHorizontalTrackMotion, useVerticalPlayerMotion } from '../hooks/useSoundCloudCarouselMotion';
import type { Song } from '../types/Song';
import { SOUNDCLOUD_PLAYER_COLORS } from '../utils/appThemeOverlays';
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
  canSwipeToNext?: boolean;
  isPlaying: boolean;
  onSwipeToNext: () => void;
  onSwipeToPrevious: () => void;
  onCollapse: () => void;
  renderPage: SoundCloudCarouselRenderPage;
  chrome?: React.ReactNode;
  waveformGestureRef?: React.RefObject<unknown | null>;
  reduceMotion?: boolean;
}

const hasNextTrack = (song: Song | null | undefined, allowed: boolean): boolean => Boolean(song) && allowed;
const nullableSong = (song: Song | null | undefined): Song | null => song || null;

const CarouselChrome = ({ children }: { children?: React.ReactNode }) => {
  if (!children) return null;
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>{children}</View>;
};

const SoundCloudTrackCarousel: React.FC<SoundCloudTrackCarouselProps> = ({ currentSong, previousSong,
  nextSong, currentArtworkUri, previousArtworkUri, nextArtworkUri, canSwipeToNext = true,
  isPlaying, onSwipeToNext, onSwipeToPrevious, onCollapse, renderPage, chrome, waveformGestureRef,
  reduceMotion = false,
}) => {
  const { width, height } = useWindowDimensions();
  const panelWidth = Math.max(1, width);
  const horizontal = useHorizontalTrackMotion({ currentSongId: currentSong?.id, panelWidth,
    onNext: onSwipeToNext, onPrevious: onSwipeToPrevious, hasPrevious: Boolean(previousSong),
    hasNext: hasNextTrack(nextSong, canSwipeToNext), reduceMotion });
  const vertical = useVerticalPlayerMotion({ height: Math.max(1, height), onCollapse, reduceMotion });
  const trackTranslateX = useMemo(
    () => Animated.add(horizontal.constrainedDrag, -panelWidth),
    [horizontal.constrainedDrag, panelWidth],
  );
  return (
    <View testID="soundcloud-track-carousel-root" style={styles.root}>
      <PanGestureHandler testID="soundcloud-collapse-gesture" activeOffsetY={[-100000, 24]}
        failOffsetX={[-18, 18]} onGestureEvent={vertical.onGestureEvent}
        onHandlerStateChange={vertical.onStateChange}>
        <Animated.View style={[styles.player, { opacity: vertical.opacity,
          transform: [{ translateY: vertical.translateY }, { scale: vertical.scale }] }]}
          testID="soundcloud-collapsible-player">
          <PanGestureHandler testID="soundcloud-track-swipe-gesture" activeOffsetX={[-18, 18]}
            failOffsetY={[-18, 18]} waitFor={waveformGestureRef}
            onGestureEvent={horizontal.onGestureEvent}
            onHandlerStateChange={horizontal.onStateChange}>
            <Animated.View testID="soundcloud-track-carousel"
              style={[styles.track, { width: panelWidth * 3, transform: [{ translateX: trackTranslateX }] }]}>
              <View style={{ width: panelWidth }}>
                <SoundCloudCarouselPanel song={nullableSong(previousSong)} role="previous" artworkUri={previousArtworkUri}
                  panelWidth={panelWidth} horizontalDrag={horizontal.drag} isPlaying={false}
                  reduceMotion={reduceMotion} renderPage={renderPage} />
              </View>
              <View style={{ width: panelWidth }}>
                <SoundCloudCarouselPanel song={currentSong} role="current" artworkUri={currentArtworkUri}
                  panelWidth={panelWidth} horizontalDrag={horizontal.drag} isPlaying={isPlaying}
                  reduceMotion={reduceMotion} renderPage={renderPage} />
              </View>
              <View style={{ width: panelWidth }}>
                <SoundCloudCarouselPanel song={nullableSong(nextSong)} role="next" artworkUri={nextArtworkUri}
                  panelWidth={panelWidth} horizontalDrag={horizontal.drag} isPlaying={false}
                  reduceMotion={reduceMotion} renderPage={renderPage} />
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
  player: { flex: 1, overflow: 'hidden', backgroundColor: SOUNDCLOUD_PLAYER_COLORS.playerBackground },
  track: { flex: 1, flexDirection: 'row' },
});

export default React.memo(SoundCloudTrackCarousel);
