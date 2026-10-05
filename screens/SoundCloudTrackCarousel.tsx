import React, { useCallback, useMemo } from 'react';
import { Animated, StyleSheet, View, useWindowDimensions } from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { useVerticalPlayerMotion } from '../hooks/useSoundCloudCarouselMotion';
import type { Song } from '../types/Song';
import SoundCloudCarouselPanel from './SoundCloudCarouselPanel';
import NativeTrackPager from '../components/NativeTrackPager';
import type { SoundCloudCarouselRenderPage } from './soundCloudCarouselTypes';

export type { SoundCloudCarouselPageRole } from './soundCloudCarouselTypes';

export interface SoundCloudTrackCarouselProps {
  currentSong: Song | null;
  queue?: Song[];
  onSelectSong?: (song: Song) => void | Promise<void>;
  wrapToStart?: boolean;
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

const CarouselChrome = ({ children }: { children?: React.ReactNode }) => {
  if (!children) return null;
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>{children}</View>;
};

const SoundCloudTrackCarousel: React.FC<SoundCloudTrackCarouselProps> = ({ currentSong, previousSong,
  nextSong, currentArtworkUri, previousArtworkUri, nextArtworkUri, isPlaying, topInset, bottomInset,
  onSwipeToNext, onSwipeToPrevious, onCollapse, onOpenQueue, queue, onSelectSong, wrapToStart,
  onQueuePreviewStart, onQueuePreviewEnd, verticalDrag, verticalGestureEnabled = true,
  renderPage, chrome, waveformGestureRef, reduceMotion = false,
}) => {
  const { width, height } = useWindowDimensions();
  const panelWidth = Math.max(1, width);
  const songs = useMemo(() => queue?.length ? queue : [previousSong, currentSong, nextSong]
    .filter((item): item is Song => Boolean(item)), [currentSong, nextSong, previousSong, queue]);
  const selectSong = useCallback((song: Song) => {
    if (onSelectSong) return onSelectSong(song);
    if (song.id === previousSong?.id) return onSwipeToPrevious();
    return onSwipeToNext();
  }, [onSelectSong, onSwipeToNext, onSwipeToPrevious, previousSong?.id]);
  const vertical = useVerticalPlayerMotion({ drag: verticalDrag, height: Math.max(1, height),
    onCollapse, onOpenQueue, onQueuePreviewStart, onQueuePreviewEnd, reduceMotion });
  const renderTrack = useCallback((song: Song) => {
    const role = song.id === currentSong?.id ? 'current'
      : song.id === previousSong?.id ? 'previous' : 'next';
    const artworkUri = role === 'current' ? currentArtworkUri : role === 'previous' ? previousArtworkUri
      : song.id === nextSong?.id ? nextArtworkUri : undefined;
    return <View style={styles.carouselViewport}>
      <SoundCloudCarouselPanel song={song} role={role} artworkUri={artworkUri} paused={!isPlaying}
        topInset={topInset} bottomInset={bottomInset} />
      <View style={styles.currentPage}>{renderPage({ song, role })}</View>
    </View>;
  }, [bottomInset, currentArtworkUri, currentSong?.id, isPlaying, nextArtworkUri, nextSong?.id,
    previousArtworkUri, previousSong?.id, renderPage, topInset]);
  return <View testID="soundcloud-track-carousel-root" style={styles.root}>
    <PanGestureHandler testID="soundcloud-collapse-gesture" enabled={verticalGestureEnabled}
      activeOffsetY={[-24, 24]} failOffsetX={[-18, 18]} onGestureEvent={vertical.onGestureEvent}
      onHandlerStateChange={vertical.onStateChange}>
      <Animated.View style={[styles.player, { opacity: vertical.opacity,
        transform: [{ translateY: vertical.translateY }, { scale: vertical.scale }] }]}
        testID="soundcloud-collapsible-player">
        <NativeTrackPager songs={songs} currentSongId={currentSong?.id} width={panelWidth}
          onSelectSong={selectSong} renderPage={renderTrack} testID="soundcloud-track-carousel"
          waitFor={waveformGestureRef} reduceMotion={reduceMotion} wrapToStart={wrapToStart} style={styles.player} />
        <CarouselChrome>{chrome}</CarouselChrome>
      </Animated.View>
    </PanGestureHandler>
  </View>;
};

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', backgroundColor: 'transparent' },
  player: { flex: 1, overflow: 'hidden', backgroundColor: 'transparent' },
  carouselViewport: { flex: 1, overflow: 'hidden' },
  track: { flex: 1, flexDirection: 'row' },
  currentPage: { ...StyleSheet.absoluteFillObject },
});

export default React.memo(SoundCloudTrackCarousel);
