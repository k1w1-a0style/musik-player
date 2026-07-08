import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { theme as staticTheme } from '../theme';
import AppErrorBoundary from '../components/AppErrorBoundary';
import Screen from '../components/Screen';
import NowPlayingBackdrop from './NowPlayingBackdrop';
import NowPlayingHeader from './NowPlayingHeader';
import NowPlayingMenuModal from './NowPlayingMenuModal';
import NowPlayingSnapPager from './NowPlayingSnapPager';
import NowPlayingPlayerPanel from './NowPlayingPlayerPanel';
import NowPlayingDetailsPanel from './NowPlayingDetailsPanel';
import { buildNowPlayingLayoutMetrics } from './nowPlayingLayout';
import { useNowPlayingScreenState } from './useNowPlayingScreenState';

const NowPlayingScreenInner: React.FC = () => {
  const {
    currentSong,
    seekTo,
    isPlaying,
    volume,
    setVolume,
    position,
    duration,
    bottomInset,
    favorite,
    favoritePending,
    toggleFavorite,
    menuOpen,
    openMenu,
    closeMenu,
    handleClose,
    openTrackInfo,
    saveCurrentQueueAsPlaylist,
    queue,
    playQueueItemById,
    moveQueueItem,
    canReorderQueue,
    controlsMode,
    swipeToNext,
    swipeToPrevious,
    accent,
    gradientColors,
    albumTitle,
    artworkUri,
    progressAccent,
    progressAccentDark,
    foregroundOnAccent,
  } = useNowPlayingScreenState();

  const { width, height } = useWindowDimensions();
  const [measuredPagerHeight, setMeasuredPagerHeight] = useState(0);
  const availablePagerHeight = measuredPagerHeight > 0
    ? measuredPagerHeight
    : Math.max(1, height - bottomInset - 48 - staticTheme.spacing.xs);
  const layoutMetrics = useMemo(() => buildNowPlayingLayoutMetrics({
    width,
    height: availablePagerHeight,
  }), [availablePagerHeight, width]);

  const handlePagerLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.floor(event.nativeEvent.layout.height);
    setMeasuredPagerHeight(current => (Math.abs(current - nextHeight) > 1 ? nextHeight : current));
  }, []);

  const renderPlayerPage = useCallback(() => (
    <NowPlayingPlayerPanel
      currentSong={currentSong}
      artworkUri={artworkUri}
      isPlaying={isPlaying}
      accent={accent}
      coverAreaHeight={layoutMetrics.coverAreaHeight}
      coverSize={layoutMetrics.coverSize}
      favorite={favorite}
      favoritePending={favoritePending}
      onToggleFavorite={toggleFavorite}
      position={position}
      duration={duration}
      onSeek={seekTo}
      progressAccent={progressAccent}
      progressAccentDark={progressAccentDark}
      foregroundOnAccent={foregroundOnAccent}
      volume={volume}
      onVolumeChange={setVolume}
      bottomInset={bottomInset}
      onOpenTrackInfo={openTrackInfo}
      controlsMode={controlsMode}
      onSwipeToNext={swipeToNext}
      onSwipeToPrevious={swipeToPrevious}
    />
  ), [accent, artworkUri, bottomInset, controlsMode, currentSong, duration, favorite, favoritePending, foregroundOnAccent, isPlaying, layoutMetrics.coverAreaHeight, layoutMetrics.coverSize, openTrackInfo, position, progressAccent, progressAccentDark, seekTo, setVolume, swipeToNext, swipeToPrevious, toggleFavorite, volume]);

  const renderDetailsPage = useCallback(() => (
    <NowPlayingDetailsPanel
      queue={queue}
      currentSong={currentSong}
      albumTitle={albumTitle}
      accentMuted={progressAccent}
      foregroundOnAccent={foregroundOnAccent}
      listHeight={layoutMetrics.detailPageListHeight}
      onPlayQueueItem={playQueueItemById}
      onQueueShift={moveQueueItem}
      canShiftQueue={canReorderQueue}
    />
  ), [albumTitle, canReorderQueue, currentSong, foregroundOnAccent, layoutMetrics.detailPageListHeight, moveQueueItem, playQueueItemById, progressAccent, queue]);

  return (
    <>
      <NowPlayingBackdrop
        gradientColors={gradientColors}
        accent={accent}
        glowLeft={layoutMetrics.glowLeft}
        artworkUri={artworkUri}
      />

      <NowPlayingHeader albumTitle={albumTitle} onClose={handleClose} onMore={openMenu} />

      <View style={styles.pagerSlot} onLayout={handlePagerLayout} testID="now-playing-pager-slot">
        <NowPlayingSnapPager
          pageHeight={layoutMetrics.snapPageHeight}
          renderPlayerPage={renderPlayerPage}
          renderDetailsPage={renderDetailsPage}
        />
      </View>

      <NowPlayingMenuModal
        visible={menuOpen}
        favorite={favorite}
        onClose={closeMenu}
        onOpenTrackInfo={openTrackInfo}
        onToggleFavorite={toggleFavorite}
        onSaveQueueAsPlaylist={saveCurrentQueueAsPlaylist}
      />
    </>
  );
};

const NowPlaying: React.FC = () => (
  <Screen style={styles.root} testID="now-playing-screen" contentStyle={styles.content}>
    <AppErrorBoundary
      fallbackMessage="Bereich konnte nicht geladen werden."
      logPrefix="[NowPlaying] ErrorBoundary caught an error"
      testID="now-playing-error-boundary-fallback"
    >
      <NowPlayingScreenInner />
    </AppErrorBoundary>
  </Screen>
);

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, paddingTop: staticTheme.spacing.xs, paddingBottom: 0 },
  pagerSlot: { flex: 1, minHeight: 1 },
});

export default NowPlaying;
