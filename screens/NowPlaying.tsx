import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, Dimensions, FlatList, Pressable, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ChevronDown, Disc3, Heart, MoreHorizontal } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNowPlayingMusicContext } from '../contexts/MusicContext';
import { usePlaybackProgress } from '../contexts/PlaybackProgressContext';
import Controls from '../components/Controls';
import ProgressBar from '../components/ProgressBar';
import ModernControls from '../components/ModernControls';
import Visualizer from '../components/Visualizer';
import GlassCard from '../components/GlassCard';
import type { Song } from '../types/Song';
import { theme } from '../theme';
import Screen from '../components/Screen';
import { getSongArtworkUri } from '../utils/songArtwork';
import { APP_STACK_ROUTES } from '../types/routes';
import { isFavoriteSongId, setFavoriteSongId } from '../utils/storage';
import {
  buildNowPlayingQueue,
  buildQueueById,
  formatVisualizerHint,
} from './nowPlayingHelpers';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const COVER_SIZE = Math.min(SCREEN_W - 118, Math.max(140, Math.floor(SCREEN_H * 0.20)));
const QUEUE_ROW_HEIGHT = 44;

const NowPlaying: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { playbackQueue, currentSong, seekTo, isPlaying, volume, setVolume, palette, fftBins, visualizerError, playSong } = useNowPlayingMusicContext();
  const { position, duration } = usePlaybackProgress();
  const [favorite, setFavorite] = useState(false);
  const [favoritePending, setFavoritePending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const queue: Song[] = useMemo(
    () => buildNowPlayingQueue(playbackQueue, currentSong),
    [playbackQueue, currentSong],
  );
  const queueById = useMemo(() => buildQueueById(queue), [queue]);

  useEffect(() => {
    let cancelled = false;
    if (!currentSong?.id) {
      setFavorite(false);
      setFavoritePending(false);
      return;
    }
    isFavoriteSongId(currentSong.id).then(value => {
      if (!cancelled) setFavorite(value);
    });
    return () => { cancelled = true; };
  }, [currentSong?.id]);

  const showVisualizer = false;
  const accent = palette?.vibrant ?? palette?.dominant ?? theme.palette.accent;
  const accentDark = palette?.darkVibrant ?? palette?.darkMuted ?? theme.palette.backgroundDeep;
  const gradientColors = theme.gradients.nowPlayingBackdrop(accent, accentDark);
  const albumTitle = currentSong?.album ?? 'Aus deiner Bibliothek';
  const visualizerHint = useMemo(() => formatVisualizerHint(visualizerError), [visualizerError]);
  const artworkUri = getSongArtworkUri(currentSong);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const playQueueItemById = useCallback((songId: string) => {
    const item = queueById.get(songId);
    if (!item || item.id === currentSong?.id) return;
    void playSong(item, queue);
  }, [currentSong?.id, playSong, queue, queueById]);

  const openTrackInfo = useCallback(() => {
    setMenuOpen(false);
    if (!currentSong) return;
    navigation.navigate(APP_STACK_ROUTES.TRACK_INFO, { songId: currentSong.id });
  }, [currentSong, navigation]);

  const toggleFavorite = useCallback(() => {
    if (!currentSong?.id || favoritePending) return;
    const songId = currentSong.id;
    const previous = favorite;
    const next = !favorite;
    setFavorite(next);
    setFavoritePending(true);
    void setFavoriteSongId(songId, next)
      .catch(() => {
        setFavorite(previous);
      })
      .finally(() => {
        setFavoritePending(false);
      });
  }, [currentSong?.id, favorite, favoritePending]);

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

      <NowPlayingHeader albumTitle={albumTitle} onClose={handleClose} onMore={() => setMenuOpen(true)} />

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
          <Visualizer bins={fftBins} active={isPlaying} color={palette?.vibrant ?? theme.palette.primary} height={44} />
          {!!visualizerHint && <Text style={styles.visualizerHint}>{visualizerHint}</Text>}
        </View>
      ) : null}

      <ProgressBar currentPosition={position} duration={duration} onSeek={seekTo} accent={palette?.vibrant ?? theme.palette.primary} accentDark={palette?.lightVibrant ?? theme.palette.primaryDark} />
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

      <BottomControlsRow volume={volume} onVolumeChange={setVolume} bottomInset={insets.bottom} onOpenTrackInfo={openTrackInfo} />

      <Modal transparent animationType="fade" visible={menuOpen} onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <View style={styles.menuCard}>
            <MenuItem label="TrackInfo öffnen" onPress={openTrackInfo} />
            <MenuItem label={favorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'} onPress={() => { toggleFavorite(); setMenuOpen(false); }} />
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