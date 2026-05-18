import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Controls from '../components/Controls';
import ProgressBar from '../components/ProgressBar';
import Visualizer from '../components/Visualizer';
import { theme } from '../theme';
import Screen from '../components/Screen';
import NowPlayingBottomControlsRow from './NowPlayingBottomControlsRow';
import NowPlayingCoverArtwork from './NowPlayingCoverArtwork';
import NowPlayingHeader from './NowPlayingHeader';
import NowPlayingMenuModal from './NowPlayingMenuModal';
import NowPlayingQueueCard from './NowPlayingQueueCard';
import NowPlayingTitleRow from './NowPlayingTitleRow';
import { useNowPlayingScreenState } from './useNowPlayingScreenState';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const COVER_SIZE = Math.min(SCREEN_W - 118, Math.max(140, Math.floor(SCREEN_H * 0.20)));
const QUEUE_CARD_MAX_HEIGHT = Math.min(236, Math.max(132, Math.floor(SCREEN_H * 0.27)));

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
      <LinearGradient pointerEvents="none" colors={gradientColors} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[styles.glowOrb, { backgroundColor: accent }]} />
      <BlurView pointerEvents="none" intensity={theme.blur.medium} tint="dark" style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(5,6,10,0.0)', 'rgba(5,6,10,0.55)', 'rgba(5,6,10,0.95)']} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <NowPlayingHeader albumTitle={albumTitle} onClose={handleClose} onMore={openMenu} />

      <View style={styles.coverArea}>
        <NowPlayingCoverArtwork song={currentSong} artworkUri={artworkUri} isPlaying={isPlaying} accent={accent} coverSize={COVER_SIZE} />
      </View>

      <NowPlayingTitleRow
        currentSong={currentSong}
        favorite={favorite}
        favoritePending={favoritePending}
        onToggleFavorite={toggleFavorite}
      />

      {showVisualizer ? (
        <View style={styles.visualizerWrap}>
          <Visualizer bins={fftBins} active={isPlaying} color={visualizerColor} height={44} />
          {!!visualizerHint && <Text style={styles.visualizerHint}>{visualizerHint}</Text>}
        </View>
      ) : null}

      <ProgressBar currentPosition={position} duration={duration} onSeek={seekTo} accent={progressAccent} accentDark={progressAccentDark} />
      <Controls />

      <NowPlayingQueueCard
        queue={queue}
        currentSongId={currentSong?.id}
        maxHeight={QUEUE_CARD_MAX_HEIGHT}
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
  glowOrb: { position: 'absolute', width: 260, height: 260, borderRadius: 130, top: 150, left: SCREEN_W / 2 - 130, opacity: 0.14 },
  coverArea: { height: COVER_SIZE + 8, alignItems: 'center', justifyContent: 'center', marginTop: 0 },
  visualizerWrap: { paddingHorizontal: 20, marginTop: 4, marginBottom: theme.spacing.sm },
  visualizerHint: { marginTop: 6, textAlign: 'center', color: theme.palette.text.muted, fontSize: 12, lineHeight: 16 },
});

export default NowPlaying;
