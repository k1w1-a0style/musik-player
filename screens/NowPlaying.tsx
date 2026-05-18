import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, Pressable, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Heart } from 'lucide-react-native';
import Controls from '../components/Controls';
import ProgressBar from '../components/ProgressBar';
import Visualizer from '../components/Visualizer';
import type { Song } from '../types/Song';
import { theme } from '../theme';
import Screen from '../components/Screen';
import NowPlayingBottomControlsRow from './NowPlayingBottomControlsRow';
import NowPlayingCoverArtwork from './NowPlayingCoverArtwork';
import NowPlayingHeader from './NowPlayingHeader';
import NowPlayingMenuItem from './NowPlayingMenuItem';
import NowPlayingQueuePreviewRow from './NowPlayingQueuePreviewRow';
import { useNowPlayingScreenState } from './useNowPlayingScreenState';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const COVER_SIZE = Math.min(SCREEN_W - 118, Math.max(140, Math.floor(SCREEN_H * 0.20)));
const QUEUE_ROW_HEIGHT = 44;

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

  const renderQueueItem = useCallback(
    ({ item }: { item: Song }) => (
      <NowPlayingQueuePreviewRow
        id={item.id}
        title={item.title}
        artist={item.artist}
        isCurrent={item.id === currentSong?.id}
        onPress={playQueueItemById}
      />
    ),
    [currentSong?.id, playQueueItemById],
  );

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

      <View style={styles.titleRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={2}>{currentSong?.title ?? 'Kein Titel ausgewählt'}</Text>
          <Text style={styles.artist} numberOfLines={1}>{currentSong?.artist ?? 'Wähle einen Song aus der Bibliothek'}</Text>
        </View>
        <Pressable disabled={favoritePending} onPress={toggleFavorite} style={styles.heartBtn} hitSlop={12} accessibilityRole="button" accessibilityLabel="Track favorisieren" accessibilityState={{ disabled: favoritePending }}>
          <Heart color={favorite ? theme.palette.primary : theme.palette.text.primary} fill={favorite ? theme.palette.primary : 'transparent'} size={22} />
        </Pressable>
      </View>

      {showVisualizer ? (
        <View style={styles.visualizerWrap}>
          <Visualizer bins={fftBins} active={isPlaying} color={visualizerColor} height={44} />
          {!!visualizerHint && <Text style={styles.visualizerHint}>{visualizerHint}</Text>}
        </View>
      ) : null}

      <ProgressBar currentPosition={position} duration={duration} onSeek={seekTo} accent={progressAccent} accentDark={progressAccentDark} />
      <Controls />

      {queue.length > 1 && (
        <View style={styles.queueCard}>
          <View style={styles.queueHeaderRow}>
            <Text style={styles.queueEyebrow}>QUEUE</Text>
            <Text style={styles.queueCount}>{queue.length} Tracks</Text>
          </View>
          <FlatList
            data={queue}
            keyExtractor={item => item.id}
            renderItem={renderQueueItem}
            nestedScrollEnabled
            showsVerticalScrollIndicator={queue.length > 3}
            getItemLayout={(_, index) => ({ length: QUEUE_ROW_HEIGHT, offset: QUEUE_ROW_HEIGHT * index, index })}
            style={styles.queueList}
          />
        </View>
      )}

      <NowPlayingBottomControlsRow volume={volume} onVolumeChange={setVolume} bottomInset={bottomInset} onOpenTrackInfo={openTrackInfo} />

      <Modal transparent animationType="fade" visible={menuOpen} onRequestClose={closeMenu}>
        <Pressable style={styles.menuBackdrop} onPress={closeMenu}>
          <View style={styles.menuCard}>
            <NowPlayingMenuItem label="TrackInfo öffnen" onPress={openTrackInfo} />
            <NowPlayingMenuItem label={favorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'} onPress={() => { toggleFavorite(); closeMenu(); }} />
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, paddingTop: theme.spacing.xs, paddingBottom: 0 },
  glowOrb: { position: 'absolute', width: 260, height: 260, borderRadius: 130, top: 150, left: SCREEN_W / 2 - 130, opacity: 0.14 },
  coverArea: { height: COVER_SIZE + 8, alignItems: 'center', justifyContent: 'center', marginTop: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginTop: 2, marginBottom: 6 },
  titleBlock: { flex: 1, minWidth: 0 },
  title: { color: theme.palette.text.primary, fontSize: 21, letterSpacing: -0.55, fontFamily: theme.fonts.display },
  artist: { color: theme.palette.text.secondary, fontSize: 13, marginTop: 2, fontFamily: theme.fonts.body },
  heartBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  visualizerWrap: { paddingHorizontal: 20, marginTop: 4, marginBottom: theme.spacing.sm },
  visualizerHint: { marginTop: 6, textAlign: 'center', color: theme.palette.text.muted, fontSize: 12, lineHeight: 16 },
  queueCard: { marginHorizontal: 16, marginTop: 4, padding: 12, borderRadius: theme.radii.card, backgroundColor: theme.palette.surfaceGlass, borderWidth: 1, borderColor: theme.palette.border, maxHeight: Math.min(236, Math.max(132, Math.floor(SCREEN_H * 0.27))) },
  queueHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  queueEyebrow: { color: theme.palette.primary, fontFamily: theme.fonts.heading, fontSize: 11, letterSpacing: 1.4 },
  queueCount: { color: theme.palette.text.muted, fontFamily: theme.fonts.body, fontSize: 11 },
  queueList: { maxHeight: QUEUE_ROW_HEIGHT * 4.4 },
  menuBackdrop: { flex: 1, alignItems: 'flex-end', paddingTop: 54, paddingRight: 22, backgroundColor: 'rgba(0,0,0,0.20)' },
  menuCard: { width: 235, borderRadius: 20, backgroundColor: '#343438', paddingVertical: 8, borderWidth: 1, borderColor: theme.palette.border },
});

export default NowPlaying;
