import React, { useCallback } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import { theme } from '../theme';
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

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const layoutMetrics = buildNowPlayingLayoutMetrics({ width: SCREEN_W, height: SCREEN_H });

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
    accent,
    accentMuted,
    gradientColors,
    albumTitle,
    artworkUri,
    progressAccent,
    progressAccentDark,
    foregroundOnAccent,
  } = useNowPlayingScreenState();

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
    />
  ), [accent, artworkUri, bottomInset, currentSong, duration, favorite, favoritePending, foregroundOnAccent, isPlaying, openTrackInfo, position, progressAccent, progressAccentDark, seekTo, setVolume, toggleFavorite, volume]);

  const renderDetailsPage = useCallback(() => (
    <NowPlayingDetailsPanel
      queue={queue}
      currentSong={currentSong}
      albumTitle={albumTitle}
      accentMuted={accentMuted}
      foregroundOnAccent={foregroundOnAccent}
      listHeight={layoutMetrics.detailPageListHeight}
      onPlayQueueItem={playQueueItemById}
      onQueueShift={moveQueueItem}
      canShiftQueue={canReorderQueue}
    />
  ), [accentMuted, albumTitle, canReorderQueue, currentSong, foregroundOnAccent, moveQueueItem, playQueueItemById, queue]);

  return (
    <>
      <NowPlayingBackdrop
        gradientColors={gradientColors}
        accent={accent}
        glowLeft={layoutMetrics.glowLeft}
        artworkUri={artworkUri}
      />

      <NowPlayingHeader albumTitle={albumTitle} onClose={handleClose} onMore={openMenu} />

      <NowPlayingSnapPager
        pageHeight={layoutMetrics.snapPageHeight}
        renderPlayerPage={renderPlayerPage}
        renderDetailsPage={renderDetailsPage}
      />

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
  content: { flex: 1, paddingTop: theme.spacing.xs, paddingBottom: 0 },
});

export default NowPlaying;
