import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { theme } from '../theme';
import AppErrorBoundary from '../components/AppErrorBoundary';
import Screen from '../components/Screen';
import NowPlayingBackdrop from './NowPlayingBackdrop';
import NowPlayingBottomControlsRow from './NowPlayingBottomControlsRow';
import NowPlayingCoverArtwork from './NowPlayingCoverArtwork';
import NowPlayingHeader from './NowPlayingHeader';
import NowPlayingMenuModal from './NowPlayingMenuModal';
import NowPlayingPlaybackSection from './NowPlayingPlaybackSection';
import NowPlayingQueueCard from './NowPlayingQueueCard';
import NowPlayingTitleRow from './NowPlayingTitleRow';
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
    accent,
    gradientColors,
    albumTitle,
    artworkUri,
    progressAccent,
    progressAccentDark,
  } = useNowPlayingScreenState();

  return (
    <>
      <NowPlayingBackdrop gradientColors={gradientColors} accent={accent} glowLeft={layoutMetrics.glowLeft} />

      <NowPlayingHeader albumTitle={albumTitle} onClose={handleClose} onMore={openMenu} />

      <View style={[styles.coverArea, { height: layoutMetrics.coverAreaHeight }]}>
        <NowPlayingCoverArtwork
          song={currentSong}
          artworkUri={artworkUri}
          isPlaying={isPlaying}
          accent={accent}
          coverSize={layoutMetrics.coverSize}
        />
      </View>

      <NowPlayingTitleRow
        currentSong={currentSong}
        favorite={favorite}
        favoritePending={favoritePending}
        onToggleFavorite={toggleFavorite}
      />

      <NowPlayingPlaybackSection
        position={position}
        duration={duration}
        onSeek={seekTo}
        progressAccent={progressAccent}
        progressAccentDark={progressAccentDark}
      />

      <NowPlayingQueueCard
        queue={queue}
        currentSongId={currentSong?.id}
        maxHeight={layoutMetrics.queueCardMaxHeight}
        onPlayQueueItem={playQueueItemById}
      />

      <NowPlayingBottomControlsRow volume={volume} onVolumeChange={setVolume} bottomInset={bottomInset} onOpenTrackInfo={openTrackInfo} />

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
  coverArea: { alignItems: 'center', justifyContent: 'center', marginTop: 0 },
});

export default NowPlaying;
