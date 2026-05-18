import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Controls from '../components/Controls';
import ProgressBar from '../components/ProgressBar';
import { theme } from '../theme';
import Screen from '../components/Screen';
import NowPlayingBackdrop from './NowPlayingBackdrop';
import NowPlayingBottomControlsRow from './NowPlayingBottomControlsRow';
import NowPlayingCoverArtwork from './NowPlayingCoverArtwork';
import NowPlayingHeader from './NowPlayingHeader';
import NowPlayingMenuModal from './NowPlayingMenuModal';
import NowPlayingQueueCard from './NowPlayingQueueCard';
import NowPlayingTitleRow from './NowPlayingTitleRow';
import NowPlayingVisualizerSection from './NowPlayingVisualizerSection';
import { buildNowPlayingLayoutMetrics } from './nowPlayingLayout';
import { useNowPlayingScreenState } from './useNowPlayingScreenState';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const layoutMetrics = buildNowPlayingLayoutMetrics({ width: SCREEN_W, height: SCREEN_H });

const NowPlaying: React.FC = () => {
  const {
    currentSong,
    seekTo,
    isPlaying,
    volume,
    setVolume,
    fftBins,
    position,
    duration,
    bottomInset,
    showVisualizer,
    favorite,
    favoritePending,
    toggleFavorite,
    menuOpen,
    openMenu,
    closeMenu,
    handleClose,
    openTrackInfo,
    queue,
    playQueueItemById,
    accent,
    gradientColors,
    albumTitle,
    visualizerHint,
    artworkUri,
    progressAccent,
    progressAccentDark,
    visualizerColor,
  } = useNowPlayingScreenState();

  return (
    <Screen style={styles.root} testID="now-playing-screen" contentStyle={styles.content}>
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

      <NowPlayingVisualizerSection
        visible={showVisualizer}
        fftBins={fftBins}
        isPlaying={isPlaying}
        color={visualizerColor}
        hint={visualizerHint}
      />

      <ProgressBar currentPosition={position} duration={duration} onSeek={seekTo} accent={progressAccent} accentDark={progressAccentDark} />
      <Controls />

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
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, paddingTop: theme.spacing.xs, paddingBottom: 0 },
  coverArea: { alignItems: 'center', justifyContent: 'center', marginTop: 0 },
});

export default NowPlaying;
