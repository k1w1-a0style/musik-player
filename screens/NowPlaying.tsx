import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Image, Dimensions, FlatList, Pressable, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ChevronDown, Disc3, Heart, MoreHorizontal } from 'lucide-react-native';
import Controls from '../components/Controls';
import ProgressBar from '../components/ProgressBar';
import ModernControls from '../components/ModernControls';
import Visualizer from '../components/Visualizer';
import GlassCard from '../components/GlassCard';
import type { Song } from '../types/Song';
import { theme } from '../theme';
import Screen from '../components/Screen';
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
      <QueuePreviewRow
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
        <CoverArtwork song={currentSong} artworkUri={artworkUri} isPlaying={isPlaying} accent={accent} />
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

      <BottomControlsRow volume={volume} onVolumeChange={setVolume} bottomInset={bottomInset} onOpenTrackInfo={openTrackInfo} />

      <Modal transparent animationType="fade" visible={menuOpen} onRequestClose={closeMenu}>
        <Pressable style={styles.menuBackdrop} onPress={closeMenu}>
          <View style={styles.menuCard}>
            <MenuItem label="TrackInfo öffnen" onPress={openTrackInfo} />
            <MenuItem label={favorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'} onPress={() => { toggleFavorite(); closeMenu(); }} />
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
};

interface QueuePreviewRowProps {
  id: string;
  title: string;
  artist: string;
  isCurrent: boolean;
  onPress: (songId: string) => void;
}

const NowPlayingHeader = React.memo(({ albumTitle, onClose, onMore }: { albumTitle: string; onClose: () => void; onMore: () => void }) => (
  <View style={styles.headerBar}>
    <Pressable testID="now-playing-close" style={styles.headerBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Now Playing schließen">
      <ChevronDown color={theme.palette.text.primary} size={22} />
    </Pressable>
    <View style={styles.headerTitleWrap}>
      <Text style={styles.headerEyebrow}>JETZT LÄUFT</Text>
      <Text style={styles.headerTitle} numberOfLines={1}>{albumTitle}</Text>
    </View>
    <Pressable testID="now-playing-more" style={styles.headerBtn} onPress={onMore} accessibilityRole="button" accessibilityLabel="Now Playing Menü öffnen">
      <MoreHorizontal color={theme.palette.text.primary} size={22} />
    </Pressable>
  </View>
));

const MenuItem: React.FC<{ label: string; onPress: () => void }> = ({ label, onPress }) => (
  <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}>
    <Text style={styles.menuText}>{label}</Text>
  </Pressable>
);

const QueuePreviewRow = React.memo(({ id, title, artist, isCurrent, onPress }: QueuePreviewRowProps) => {
  const handlePress = React.useCallback(() => onPress(id), [id, onPress]);
  return (
    <Pressable style={[styles.queueItem, isCurrent && styles.queueItemActive]} onPress={handlePress}>
      <View style={[styles.queueAccent, isCurrent && styles.queueAccentActive]} />
      <View style={styles.queueTextWrap}>
        <Text style={[styles.queueTitle, isCurrent && styles.queueTitleActive]} numberOfLines={1}>{title}</Text>
        <Text style={styles.queueArtist} numberOfLines={1}>{artist}</Text>
      </View>
    </Pressable>
  );
});

const BottomControlsRow = React.memo(({ volume, onVolumeChange, bottomInset, onOpenTrackInfo }: { volume: number; onVolumeChange: (v: number) => Promise<void>; bottomInset: number; onOpenTrackInfo: () => void }) => (
  <View style={[styles.bottomRow, { paddingBottom: Math.max(28, bottomInset + 24) }]}>
    <View style={styles.bottomSpacer} />
    <GlassCard style={styles.glassRow} intensity={theme.blur.medium}>
      <ModernControls volume={volume} onVolumeChange={onVolumeChange} />
    </GlassCard>
    <Pressable onPress={onOpenTrackInfo} style={styles.bottomBtn} hitSlop={10} accessibilityRole="button" accessibilityLabel="TrackInfo öffnen">
      <Disc3 color={theme.palette.text.muted} size={20} />
    </Pressable>
  </View>
));

const CoverArtwork: React.FC<{ song?: Song | null; artworkUri?: string; isPlaying: boolean; accent: string }> = ({ song, artworkUri, isPlaying, accent }) => {
  const [coverFailed, setCoverFailed] = React.useState(false);
  React.useEffect(() => setCoverFailed(false), [song?.id, artworkUri]);
  return (
    <View style={[styles.coverCard, { shadowColor: accent }]}>
      {artworkUri && !coverFailed ? (
        <Image source={{ uri: artworkUri }} style={styles.coverImage} onError={() => setCoverFailed(true)} resizeMode="cover" />
      ) : (
        <View style={[styles.discFallback, isPlaying && styles.discFallbackPlaying]}>
          <Disc3 color={theme.palette.primary} size={Math.floor(COVER_SIZE * 0.55)} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, paddingTop: theme.spacing.xs, paddingBottom: 0 },
  glowOrb: { position: 'absolute', width: 260, height: 260, borderRadius: 130, top: 150, left: SCREEN_W / 2 - 130, opacity: 0.14 },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginBottom: 2 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { alignItems: 'center', flex: 1 },
  headerEyebrow: { color: theme.palette.text.muted, fontSize: 10, letterSpacing: 1.8, fontFamily: theme.fonts.body },
  headerTitle: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 14, marginTop: 2 },
  coverArea: { height: COVER_SIZE + 8, alignItems: 'center', justifyContent: 'center', marginTop: 0 },
  coverCard: { width: COVER_SIZE, height: COVER_SIZE, borderRadius: 22, overflow: 'hidden', backgroundColor: theme.palette.surface, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.22, shadowRadius: 16, elevation: 10 },
  coverImage: { width: '100%', height: '100%' },
  discFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  discFallbackPlaying: { opacity: 0.95, transform: [{ scale: 1.02 }] },
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
  queueItem: { flexDirection: 'row', alignItems: 'center', gap: 8, height: QUEUE_ROW_HEIGHT, borderRadius: theme.borderRadius.sm, paddingHorizontal: 8 },
  queueItemActive: { backgroundColor: theme.palette.primaryGlow },
  queueAccent: { width: 3, height: 20, borderRadius: 3, backgroundColor: theme.palette.border },
  queueAccentActive: { backgroundColor: theme.palette.primary },
  queueTextWrap: { flex: 1 },
  queueTitle: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 12 },
  queueTitleActive: { color: theme.palette.primary },
  queueArtist: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 11, marginTop: 1 },
  bottomRow: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 6 },
  bottomSpacer: { width: 42, height: 42 },
  bottomBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.palette.surfaceElevated },
  glassRow: { flex: 1 },
  menuBackdrop: { flex: 1, alignItems: 'flex-end', paddingTop: 54, paddingRight: 22, backgroundColor: 'rgba(0,0,0,0.20)' },
  menuCard: { width: 235, borderRadius: 20, backgroundColor: '#343438', paddingVertical: 8, borderWidth: 1, borderColor: theme.palette.border },
  menuItem: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 18 },
  menuText: { color: theme.palette.text.primary, fontFamily: theme.fonts.body, fontSize: 16 },
  pressed: { opacity: 0.72 },
});

export default NowPlaying;
