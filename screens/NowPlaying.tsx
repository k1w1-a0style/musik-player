import React, { useCallback } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
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
import NowPlayingSnapPager from './NowPlayingSnapPager';
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
    accentMuted,
    gradientColors,
    albumTitle,
    artworkUri,
    progressAccent,
    progressAccentDark,
    foregroundOnAccent,
  } = useNowPlayingScreenState();

  const renderPlayerPage = useCallback(() => (
    <View style={styles.playerPage}>
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
      <NowPlayingBottomControlsRow volume={volume} onVolumeChange={setVolume} bottomInset={bottomInset} onOpenTrackInfo={openTrackInfo} />
    </View>
  ), [accent, artworkUri, bottomInset, currentSong, duration, favorite, favoritePending, isPlaying, openTrackInfo, position, progressAccent, progressAccentDark, seekTo, setVolume, toggleFavorite, volume]);

  const renderDetailsPage = useCallback(() => (
    <View style={styles.detailsPage} testID="now-playing-details-content">
      <View style={[styles.swipeHintRow, { borderColor: accentMuted }]}>
        <Text style={styles.swipeHintEyebrow}>NACH OBEN GEWISCHT</Text>
        <Text style={[styles.swipeHintTitle, { color: foregroundOnAccent === '#FFFFFF' ? theme.palette.text.primary : foregroundOnAccent }]}>Warteschlange & Details</Text>
      </View>
      <NowPlayingQueueCard
        queue={queue}
        currentSongId={currentSong?.id}
        maxHeight={layoutMetrics.detailPageListHeight}
        onPlayQueueItem={playQueueItemById}
      />
      <View style={[styles.detailsCard, { borderColor: accentMuted }]} testID="now-playing-details-card">
        <Text style={styles.detailsEyebrow}>METADATEN</Text>
        <Text style={styles.detailsTitle} numberOfLines={1}>{currentSong?.title ?? 'Kein Titel'}</Text>
        <Text style={styles.detailsLine} numberOfLines={1}>{currentSong?.artist ?? '—'}</Text>
        <Text style={styles.detailsLine} numberOfLines={1}>{albumTitle}</Text>
      </View>
    </View>
  ), [accentMuted, albumTitle, currentSong, foregroundOnAccent, playQueueItemById, queue]);

  return (
    <>
      <NowPlayingBackdrop gradientColors={gradientColors} accent={accent} glowLeft={layoutMetrics.glowLeft} />

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
  coverArea: { alignItems: 'center', justifyContent: 'center', marginTop: 0 },
  playerPage: { flex: 1 },
  detailsPage: { flex: 1, paddingHorizontal: 8, paddingTop: 12 },
  swipeHintRow: { marginHorizontal: 16, marginBottom: 12, paddingVertical: 10, paddingHorizontal: 14, borderRadius: theme.radii.card, borderWidth: 1, backgroundColor: theme.palette.surfaceGlass },
  swipeHintEyebrow: { color: theme.palette.text.muted, fontSize: 10, letterSpacing: 1.5, fontFamily: theme.fonts.body },
  swipeHintTitle: { fontSize: 16, fontFamily: theme.fonts.heading, marginTop: 2 },
  detailsCard: { marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: theme.radii.card, borderWidth: 1, backgroundColor: theme.palette.surfaceGlass },
  detailsEyebrow: { color: theme.palette.primary, fontFamily: theme.fonts.heading, fontSize: 11, letterSpacing: 1.4, marginBottom: 6 },
  detailsTitle: { color: theme.palette.text.primary, fontSize: 18, fontFamily: theme.fonts.display, letterSpacing: -0.35 },
  detailsLine: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 13, marginTop: 4 },
});

export default NowPlaying;
