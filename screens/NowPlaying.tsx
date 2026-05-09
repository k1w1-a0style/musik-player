import React, { useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Image, Dimensions, FlatList, ViewToken, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ChevronDown, Disc3, Heart, MoreHorizontal } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
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

const { width: SCREEN_W } = Dimensions.get('window');
const COVER_SIZE = Math.min(SCREEN_W - 32, 380);

const NowPlaying: React.FC = () => {
  const navigation = useNavigation();
  const { playbackQueue, currentSong, seekTo, isPlaying, volume, setVolume, palette, fftBins, visualizerRunning, playSong } = useNowPlayingMusicContext();
  const { position, duration } = usePlaybackProgress();

  const queue: Song[] = useMemo(
    () => (playbackQueue.length > 0 ? playbackQueue : currentSong ? [currentSong] : []),
    [playbackQueue, currentSong],
  );
  const currentIdx = currentSong ? Math.max(0, queue.findIndex(song => song.id === currentSong.id)) : 0;
  const visibleQueue = useMemo(() => queue.slice(0, 5), [queue]);
  const queueById = useMemo(() => new Map(queue.map(song => [song.id, song])), [queue]);
  const flatRef = useRef<FlatList<Song>>(null);
  const lastReportedId = useRef<string | null>(currentSong?.id ?? null);
  const currentSongRef = useRef<Song | null>(currentSong);
  const queueRef = useRef<Song[]>(queue);

  currentSongRef.current = currentSong;
  queueRef.current = queue;

  React.useEffect(() => {
    if (currentIdx >= 0 && flatRef.current) {
      flatRef.current.scrollToIndex({ index: currentIdx, animated: true });
    }
  }, [currentIdx]);

  React.useEffect(() => {
    lastReportedId.current = currentSong?.id ?? null;
  }, [currentSong?.id]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const viewable = viewableItems[0];
    if (!viewable?.item) return;

    const item = viewable.item as Song;
    const activeSong = currentSongRef.current;
    if (!activeSong) return;
    if (item.id === lastReportedId.current || item.id === activeSong.id) return;

    lastReportedId.current = item.id;
    void playSong(item, queueRef.current);
  }, [playSong]);


  const playQueueItemById = useCallback((songId: string) => {
    const item = queueById.get(songId);
    if (!item) return;

    const activeSong = currentSongRef.current;
    if (!activeSong || item.id === activeSong.id) return;

    lastReportedId.current = item.id;
    void playSong(item, queueRef.current);
  }, [playSong, queueById]);

  const accent = palette?.vibrant ?? palette?.dominant ?? theme.palette.accent;
  const accentDark = palette?.darkVibrant ?? palette?.darkMuted ?? theme.palette.backgroundDeep;
  const gradientColors = theme.gradients.nowPlayingBackdrop(accent, accentDark);

  const renderCover = useCallback(
    ({ item }: { item: Song; index: number }) => {
      const isActive = currentSong?.id === item.id;
      return (
        <View style={styles.coverSlide}>
          <CoverArtwork
            song={item}
            isActive={isActive}
            isPlaying={isActive && isPlaying}
            accent={palette?.vibrant ?? palette?.dominant ?? accent}
          />
        </View>
      );
    },
    [currentSong?.id, isPlaying, accent, palette],
  );

  return (
    <Screen style={styles.root} testID="now-playing-screen" contentStyle={styles.content}>
      <LinearGradient colors={gradientColors} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[styles.glowOrb, { backgroundColor: accent }]} />
      <BlurView intensity={theme.blur.medium} tint="dark" style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(5,6,10,0.0)', 'rgba(5,6,10,0.55)', 'rgba(5,6,10,0.95)']} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <View style={styles.headerBar}>
        <Pressable testID="now-playing-close" style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <ChevronDown color={theme.palette.text.primary} size={22} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerEyebrow}>JETZT LÄUFT</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{currentSong?.album ?? 'Aus deiner Bibliothek'}</Text>
        </View>
        <Pressable testID="now-playing-more" style={styles.headerBtn}>
          <MoreHorizontal color={theme.palette.text.primary} size={22} />
        </Pressable>
      </View>

      <FlatList
        ref={flatRef}
        data={queue}
        renderItem={renderCover}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={SCREEN_W}
        decelerationRate="fast"
        initialScrollIndex={currentIdx > 0 ? currentIdx : undefined}
        getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
        style={styles.carousel}
        contentContainerStyle={styles.carouselContent}
      />

      <View style={styles.titleRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={2}>{currentSong?.title ?? 'Kein Titel ausgewählt'}</Text>
          <Text style={styles.artist} numberOfLines={1}>{currentSong?.artist ?? 'Wähle einen Song aus der Bibliothek'}</Text>
        </View>
        <Pressable style={styles.heartBtn}><Heart color={theme.palette.text.primary} size={20} /></Pressable>
      </View>

      <View style={styles.visualizerWrap}>
        <Visualizer
          bins={fftBins}
          active={visualizerRunning && isPlaying}
          color={palette?.vibrant ?? theme.palette.primary}
          height={44}
        />
      </View>
      <ProgressBar
        currentPosition={position}
        duration={duration}
        onSeek={seekTo}
        accent={palette?.vibrant ?? theme.palette.primary}
        accentDark={palette?.lightVibrant ?? theme.palette.primaryDark}
      />
      <Controls />

      {visibleQueue.length > 1 && (
        <View style={styles.queueCard}>
          <View style={styles.queueHeaderRow}>
            <Text style={styles.queueEyebrow}>QUEUE</Text>
            <Text style={styles.queueCount}>{queue.length} Tracks</Text>
          </View>
          {visibleQueue.map(item => {
            const isCurrent = item.id === currentSong?.id;
            return (
              <QueuePreviewRow
                key={item.id}
                id={item.id}
                title={item.title}
                artist={item.artist}
                isCurrent={isCurrent}
                onPress={playQueueItemById}
              />
            );
          })}
        </View>
      )}

      <View style={styles.bottomRow}>
        <Pressable style={styles.bottomBtn}><Heart color={theme.palette.text.muted} size={20} /></Pressable>
        <GlassCard style={styles.glassRow} intensity={theme.blur.medium}>
          <ModernControls volume={volume} onVolumeChange={setVolume} />
        </GlassCard>
        <Pressable style={styles.bottomBtn}><Disc3 color={theme.palette.text.muted} size={20} /></Pressable>
      </View>
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

const QueuePreviewRow = React.memo(({ id, title, artist, isCurrent, onPress }: QueuePreviewRowProps) => {
  const handlePress = React.useCallback(() => {
    onPress(id);
  }, [id, onPress]);

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

interface CoverProps {
  song: Song;
  isActive: boolean;
  isPlaying: boolean;
  accent: string;
}

const CoverArtwork: React.FC<CoverProps> = ({ song, isActive, isPlaying, accent }) => {
  const [coverFailed, setCoverFailed] = React.useState(false);
  React.useEffect(() => {
    setCoverFailed(false);
  }, [song.id, song.cover]);
  return (
    <View style={[styles.coverCard, !isActive && styles.coverCardInactive, { shadowColor: accent }]}>
      {song.cover && !coverFailed ? (
        <Image source={{ uri: song.cover }} style={styles.coverImage} onError={() => setCoverFailed(true)} />
      ) : (
        <View style={[styles.discFallback, isPlaying && styles.discFallbackPlaying]}>
          <Disc3 color={theme.palette.primary} size={120} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, paddingTop: 12, paddingBottom: 12 },
  glowOrb: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    top: 110,
    left: SCREEN_W / 2 - 170,
    opacity: 0.18,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: { alignItems: 'center', flex: 1 },
  headerEyebrow: {
    color: theme.palette.text.muted,
    fontSize: 10,
    letterSpacing: 1.8,
    fontFamily: theme.fonts.body,
  },
  headerTitle: {
    color: theme.palette.text.primary,
    fontFamily: theme.fonts.heading,
    fontSize: 14,
    marginTop: 2,
  },
  carousel: { flexGrow: 0, height: COVER_SIZE + 10 },
  carouselContent: { alignItems: 'center' },
  coverSlide: { width: SCREEN_W, alignItems: 'center', justifyContent: 'center' },
  coverCard: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: theme.palette.surface,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 16,
  },
  coverImage: { width: '100%', height: '100%' },
  coverCardInactive: { transform: [{ scale: 0.85 }], opacity: 0.45 },
  discFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  discFallbackPlaying: { opacity: 0.95, transform: [{ scale: 1.02 }] },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 8,
  },
  titleBlock: { flex: 1 },
  title: {
    color: theme.palette.text.primary,
    fontSize: 28,
    letterSpacing: -0.7,
    fontFamily: theme.fonts.display,
  },
  artist: {
    color: theme.palette.text.secondary,
    fontSize: 15,
    marginTop: 3,
    fontFamily: theme.fonts.body,
  },
  heartBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visualizerWrap: { paddingHorizontal: 20, marginTop: 4 },
  queueCard: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: 'rgba(10, 12, 11, 0.82)',
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  queueHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  queueEyebrow: {
    color: theme.palette.primary,
    fontFamily: theme.fonts.heading,
    fontSize: 11,
    letterSpacing: 1.4,
  },
  queueCount: {
    color: theme.palette.text.muted,
    fontFamily: theme.fonts.body,
    fontSize: 11,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 38,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 8,
  },
  queueItemActive: { backgroundColor: theme.palette.primaryGlow },
  queueAccent: {
    width: 3,
    height: 20,
    borderRadius: 3,
    backgroundColor: theme.palette.border,
  },
  queueAccentActive: { backgroundColor: theme.palette.primary },
  queueTextWrap: { flex: 1 },
  queueTitle: {
    color: theme.palette.text.primary,
    fontFamily: theme.fonts.heading,
    fontSize: 12,
  },
  queueTitleActive: { color: theme.palette.primary },
  queueArtist: {
    color: theme.palette.text.secondary,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    marginTop: 1,
  },
  bottomRow: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  bottomBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.palette.surfaceElevated,
  },
  glassRow: { flex: 1 },
});

export default NowPlaying;
