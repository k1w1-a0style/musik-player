import React, { useCallback } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import type { RepeatMode, Song } from '../types/Song';
import { SOUNDCLOUD_PLAYER_COLORS } from '../utils/appThemeOverlays';
import { displayArtist, displayTitle } from '../utils/libraryPresentation';
import { runPlaybackUiAction } from '../utils/playbackUiActions';
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
    void Share.share({ title, message: artist ? `${title} — ${artist}` : title }).catch(() => undefined);
  }, [props.currentSong]);
  const renderPage = useCallback(({ song, role }: SoundCloudCarouselRenderPageArgs) => {
    if (!song) return null;
    return <SoundCloudTrackPage song={song} role={role} isPlaying={props.isPlaying}
      canSwipeToNext={canGoNext} topInset={props.topInset} bottomInset={props.bottomInset}
      onTogglePlayback={togglePlayback} onPrevious={props.onSwipeToPrevious}
      onNext={handleNext} onSeek={props.onSeek} />;
  }, [canGoNext, handleNext, props.bottomInset, props.isPlaying, props.onSeek, props.onSwipeToPrevious, props.topInset, togglePlayback]);
  const chrome = <SoundCloudPlayerChrome currentSong={props.currentSong} onCollapse={props.onCollapse}
    onOpenTrackInfo={props.onOpenTrackInfo} onOpenMenu={props.onOpenMenu} onShare={shareTrack}
    favorite={props.favorite} favoritePending={props.favoritePending} onToggleFavorite={props.onToggleFavorite}
    queue={props.queue} onPlayQueueItem={props.onPlayQueueItem} onQueueShift={props.onQueueShift}
    canShiftQueue={props.canShiftQueue} shuffle={props.shuffle} repeatMode={props.repeatMode}
    onToggleShuffle={props.onToggleShuffle} onCycleRepeatMode={props.onCycleRepeatMode}
    topInset={props.topInset} bottomInset={props.bottomInset} />;
  return (
    <View style={styles.root} testID="now-playing-soundcloud-view">
      <SoundCloudTrackCarousel currentSong={props.currentSong} previousSong={props.previousSong}
        nextSong={props.nextSong} currentArtworkUri={props.artworkUri}
        previousArtworkUri={props.previousArtworkUri} nextArtworkUri={props.nextArtworkUri}
        canSwipeToNext={canGoNext} isPlaying={props.isPlaying} onSwipeToNext={props.onSwipeToNext}
        onSwipeToPrevious={props.onSwipeToPrevious} onCollapse={props.onCollapse}
        renderPage={renderPage} chrome={chrome} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', backgroundColor: SOUNDCLOUD_PLAYER_COLORS.playerBackground },
});

export default React.memo(NowPlayingSoundCloudView);
