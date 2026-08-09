import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { APP_THEME_TOKENS } from '../utils/appTheme';
import AppErrorBoundary from '../components/AppErrorBoundary';
import Screen from '../components/Screen';
import NowPlayingBackdrop from './NowPlayingBackdrop';
import NowPlayingHeader from './NowPlayingHeader';
import NowPlayingMenuModal from './NowPlayingMenuModal';
import NowPlayingSnapPager from './NowPlayingSnapPager';
import NowPlayingPlayerPanel from './NowPlayingPlayerPanel';
import NowPlayingSoundCloudView from './NowPlayingSoundCloudView';
import NowPlayingDetailsPanel from './NowPlayingDetailsPanel';
import { buildNowPlayingLayoutMetrics } from './nowPlayingLayout';
import { useNowPlayingScreenState } from './useNowPlayingScreenState';

type NowPlayingState = ReturnType<typeof useNowPlayingScreenState>;

const NowPlayingMenu = ({ state }: { state: NowPlayingState }) => (
  <NowPlayingMenuModal
    visible={state.menuOpen}
    favorite={state.favorite}
    onClose={state.closeMenu}
    onOpenTrackInfo={state.openTrackInfo}
    onOpenEqualizer={state.openEqualizer}
    onToggleFavorite={state.toggleFavorite}
    onSaveQueueAsPlaylist={state.saveCurrentQueueAsPlaylist}
    sleepTimerActive={state.sleepTimerActive}
    sleepTimerRemainingSeconds={state.sleepTimerRemainingSeconds}
    onStartSleepTimer={state.startSleepTimer}
    onCancelSleepTimer={state.cancelSleepTimer}
  />
);

const SoundCloudNowPlayingContent = ({ state }: { state: NowPlayingState }) => (
  <Screen edges={[]} style={styles.root} contentStyle={styles.soundCloudContent} testID="now-playing-screen">
    <NowPlayingSoundCloudView
      currentSong={state.currentSong}
      previousSong={state.previousSong}
      nextSong={state.nextSong}
      artworkUri={state.artworkUri}
      previousArtworkUri={state.previousArtworkUri}
      nextArtworkUri={state.nextArtworkUri}
      isPlaying={state.isPlaying}
      onSeek={state.seekTo}
      onTogglePlayback={state.togglePlayPause}
      onSwipeToNext={state.swipeToNext}
      onSwipeToPrevious={state.swipeToPrevious}
      canSwipeToNext={state.canSwipeToNext}
      onCollapse={state.handleClose}
      onOpenTrackInfo={state.openTrackInfo}
      onOpenMenu={state.openMenu}
      favorite={state.favorite}
      favoritePending={state.favoritePending}
      onToggleFavorite={state.toggleFavorite}
      queue={state.queue}
      onPlayQueueItem={state.playQueueItemById}
      onQueueShift={state.moveQueueItem}
      canShiftQueue={state.canReorderQueue}
      shuffle={state.shuffle}
      repeatMode={state.repeatMode}
      onToggleShuffle={state.toggleShuffle}
      onCycleRepeatMode={state.cycleRepeatMode}
      topInset={state.topInset}
      bottomInset={state.bottomInset}
    />
    <NowPlayingMenu state={state} />
  </Screen>
);

const ClassicNowPlayingContent = ({ state }: { state: NowPlayingState }) => {
  const { width, height } = useWindowDimensions();
  const [measuredPagerHeight, setMeasuredPagerHeight] = useState(0);
  const availablePagerHeight = measuredPagerHeight > 0
    ? measuredPagerHeight
    : Math.max(1, height - state.bottomInset - 48 - APP_THEME_TOKENS.spacing.xs);
  const layout = useMemo(() => buildNowPlayingLayoutMetrics({ width, height: availablePagerHeight }), [availablePagerHeight, width]);
  const handlePagerLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.floor(event.nativeEvent.layout.height);
    setMeasuredPagerHeight(current => (Math.abs(current - nextHeight) > 1 ? nextHeight : current));
  }, []);
  const renderPlayer = useCallback(() => (
    <NowPlayingPlayerPanel
      currentSong={state.currentSong} artworkUri={state.artworkUri} isPlaying={state.isPlaying}
      accent={state.accent} coverAreaHeight={layout.coverAreaHeight} coverSize={layout.coverSize}
      favorite={state.favorite} favoritePending={state.favoritePending} onToggleFavorite={state.toggleFavorite}
      position={state.position} duration={state.duration} onSeek={state.seekTo}
      progressAccent={state.progressAccent} progressAccentDark={state.progressAccentDark}
      foregroundOnAccent={state.foregroundOnAccent} volume={state.volume} onVolumeChange={state.setVolume}
      bottomInset={state.bottomInset} onOpenTrackInfo={state.openTrackInfo} controlsMode={state.controlsMode}
      onSwipeToNext={state.swipeToNext} onSwipeToPrevious={state.swipeToPrevious} canSwipeToNext={state.canSwipeToNext}
    />
  ), [layout.coverAreaHeight, layout.coverSize, state]);
  const renderDetails = useCallback(() => (
    <NowPlayingDetailsPanel
      queue={state.queue} currentSong={state.currentSong} albumTitle={state.albumTitle}
      accentMuted={state.progressAccent} foregroundOnAccent={state.foregroundOnAccent}
      listHeight={layout.detailPageListHeight} onPlayQueueItem={state.playQueueItemById}
      onQueueShift={state.moveQueueItem} canShiftQueue={state.canReorderQueue}
    />
  ), [layout.detailPageListHeight, state]);

  return (
    <Screen style={styles.root} testID="now-playing-screen" contentStyle={styles.content}>
      <NowPlayingBackdrop gradientColors={state.gradientColors} accent={state.accent} glowLeft={layout.glowLeft} artworkUri={state.artworkUri} />
      <NowPlayingHeader albumTitle={state.albumTitle} sleepTimerActive={state.sleepTimerActive}
        sleepTimerRemainingSeconds={state.sleepTimerRemainingSeconds} onClose={state.handleClose} onMore={state.openMenu} />
      <View style={styles.pagerSlot} onLayout={handlePagerLayout} testID="now-playing-pager-slot">
        <NowPlayingSnapPager pageHeight={layout.snapPageHeight} renderPlayerPage={renderPlayer} renderDetailsPage={renderDetails} />
      </View>
      <NowPlayingMenu state={state} />
    </Screen>
  );
};

const NowPlayingScreenInner: React.FC = () => {
  const state = useNowPlayingScreenState();
  return state.controlsMode === 'soundcloud'
    ? <SoundCloudNowPlayingContent state={state} />
    : <ClassicNowPlayingContent state={state} />;
};

const NowPlaying: React.FC = () => (
  <AppErrorBoundary fallbackMessage="Bereich konnte nicht geladen werden."
    logPrefix="[NowPlaying] ErrorBoundary caught an error" testID="now-playing-error-boundary-fallback">
    <NowPlayingScreenInner />
  </AppErrorBoundary>
);

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, paddingTop: APP_THEME_TOKENS.spacing.xs, paddingBottom: 0 },
  soundCloudContent: { flex: 1, paddingTop: 0, paddingBottom: 0 },
  pagerSlot: { flex: 1, minHeight: 1 },
});

export default NowPlaying;
