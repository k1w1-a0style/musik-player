import React, { useCallback, useRef, useState } from 'react';
import { Alert, Share, StatusBar, StyleSheet, View, useWindowDimensions, type ColorValue } from 'react-native';
import type { RepeatMode, Song } from '../types/Song';
import { SOUNDCLOUD_PLAYER_COLORS } from '../utils/appThemeOverlays';
import { displayArtist, displayTitle } from '../utils/libraryPresentation';
import { runPlaybackUiAction } from '../utils/playbackUiActions';
import { useReducedMotion } from '../hooks/useReducedMotion';
import NowPlayingBackdrop from './NowPlayingBackdrop';
import SoundCloudPlayerChrome from './SoundCloudPlayerChrome';
import SoundCloudTrackCarousel from './SoundCloudTrackCarousel';
import SoundCloudTrackPage from './SoundCloudTrackPage';
import type { SoundCloudCarouselRenderPageArgs } from './soundCloudCarouselTypes';

interface NowPlayingSoundCloudViewProps {
  currentSong: Song | null;
  previousSong?: Song | null;
  nextSong?: Song | null;
  artworkUri?: string;
  previousArtworkUri?: string;
  nextArtworkUri?: string;
  gradientColors: readonly [ColorValue, ColorValue, ...ColorValue[]];
  accent: string;
  paletteLoading?: boolean;
  isPlaying: boolean;
  onSeek: (position: number) => Promise<void>;
  onTogglePlayback: () => Promise<void>;
  onSwipeToNext: () => void;
  onSwipeToPrevious: () => void;
  canSwipeToNext?: boolean;
  onCollapse: () => void;
  onOpenTrackInfo: () => void;
  onOpenMenu: () => void;
  favorite: boolean;
  favoritePending: boolean;
  onToggleFavorite: () => void;
  queue: Song[];
  onPlayQueueItem: (songId: string) => void;
  onQueueShift: (fromIndex: number, toIndex: number) => void;
  canShiftQueue: boolean;
  shuffle: boolean;
  repeatMode: RepeatMode;
  onToggleShuffle: () => unknown | Promise<unknown>;
  onCycleRepeatMode: () => unknown | Promise<unknown>;
  topInset: number;
  bottomInset: number;
}

const NowPlayingSoundCloudView: React.FC<NowPlayingSoundCloudViewProps> = props => {
  const waveformGestureRef = useRef<unknown>(null);
  const { width } = useWindowDimensions();
  const [queueOpen, setQueueOpen] = useState(false);
  const openQueue = useCallback(() => setQueueOpen(true), []);
  const closeQueue = useCallback(() => setQueueOpen(false), []);
  const reduceMotion = useReducedMotion();
  const { onSwipeToNext } = props;
  const canGoNext = props.canSwipeToNext ?? true;
  const togglePlayback = useCallback(() => {
    if (props.currentSong) void runPlaybackUiAction('soundcloud-toggle', props.onTogglePlayback, { dropIfPending: true });
  }, [props.currentSong, props.onTogglePlayback]);
  const handleNext = useCallback(() => {
    if (canGoNext) onSwipeToNext();
  }, [canGoNext, onSwipeToNext]);
  const shareTrack = useCallback(() => {
    if (!props.currentSong) return;
    const title = displayTitle(props.currentSong);
    const artist = displayArtist(props.currentSong);
    void Share.share({ title, message: artist ? `${title} — ${artist}` : title }).catch(() => {
      Alert.alert('Teilen nicht möglich', 'Der Titel konnte nicht geteilt werden.');
    });
  }, [props.currentSong]);
  const renderPage = useCallback(({ song, role }: SoundCloudCarouselRenderPageArgs) => {
    if (!song) return null;
    return <SoundCloudTrackPage song={song} role={role} isPlaying={props.isPlaying}
      canSwipeToNext={canGoNext} topInset={props.topInset} bottomInset={props.bottomInset}
      onTogglePlayback={togglePlayback} onPrevious={props.onSwipeToPrevious}
      onNext={handleNext} onSeek={props.onSeek} waveformGestureRef={waveformGestureRef}
      reduceMotion={reduceMotion} />;
  }, [canGoNext, handleNext, props.bottomInset, props.isPlaying, props.onSeek, props.onSwipeToPrevious,
    props.topInset, reduceMotion, togglePlayback]);
  const chrome = <SoundCloudPlayerChrome currentSong={props.currentSong} onCollapse={props.onCollapse}
    onOpenTrackInfo={props.onOpenTrackInfo} onOpenMenu={props.onOpenMenu} onShare={shareTrack}
    favorite={props.favorite} favoritePending={props.favoritePending} onToggleFavorite={props.onToggleFavorite}
    queue={props.queue} onPlayQueueItem={props.onPlayQueueItem} onQueueShift={props.onQueueShift}
    canShiftQueue={props.canShiftQueue} shuffle={props.shuffle} repeatMode={props.repeatMode}
    onToggleShuffle={props.onToggleShuffle} onCycleRepeatMode={props.onCycleRepeatMode}
    topInset={props.topInset} bottomInset={props.bottomInset} reduceMotion={reduceMotion}
    queueOpen={queueOpen} onOpenQueue={openQueue} onCloseQueue={closeQueue} />;
  return (
    <View style={styles.root} testID="now-playing-soundcloud-view">
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <NowPlayingBackdrop gradientColors={props.gradientColors} accent={props.accent}
        glowLeft={width / 2 - 130} artworkUri={props.artworkUri}
        paletteLoading={props.paletteLoading} />
      <SoundCloudTrackCarousel currentSong={props.currentSong} previousSong={props.previousSong}
        nextSong={props.nextSong} currentArtworkUri={props.artworkUri}
        previousArtworkUri={props.previousArtworkUri} nextArtworkUri={props.nextArtworkUri}
        canSwipeToNext={canGoNext} onSwipeToNext={props.onSwipeToNext}
        onSwipeToPrevious={props.onSwipeToPrevious} onCollapse={props.onCollapse}
        onOpenQueue={openQueue}
        verticalGestureEnabled={!queueOpen}
        waveformGestureRef={waveformGestureRef} reduceMotion={reduceMotion} renderPage={renderPage} chrome={chrome} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', backgroundColor: SOUNDCLOUD_PLAYER_COLORS.playerBackground },
});

export default React.memo(NowPlayingSoundCloudView);
