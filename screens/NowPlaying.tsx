import React, { useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Image, Dimensions, FlatList, ViewToken, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing, cancelAnimation, interpolate } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ChevronDown, Disc3, Heart, MoreHorizontal } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useMusicContext } from '../contexts/MusicContext';
import Controls from '../components/Controls';
import ProgressBar from '../components/ProgressBar';
import ModernControls from '../components/ModernControls';
import Visualizer from '../components/Visualizer';
import GlassCard from '../components/GlassCard';
import type { Song } from '../types/Song';
import { theme } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');
const COVER_SIZE = Math.min(SCREEN_W - 32, 380);

const NowPlaying: React.FC = () => {
  const navigation = useNavigation();
  const { songs, currentSong, position, duration, seekTo, isPlaying, volume, setVolume, palette, fftBins, visualizerRunning, playSong } = useMusicContext();

  const queue: Song[] = useMemo(() => (songs.length === 0 && currentSong ? [currentSong] : songs), [songs, currentSong]);
  const currentIdx = currentSong ? Math.max(0, queue.findIndex(s => s.id === currentSong.id)) : 0;
  const flatRef = useRef<FlatList<Song>>(null);
  const lastReportedId = useRef<string | null>(currentSong?.id ?? null);

  React.useEffect(() => {
    if (currentIdx >= 0 && flatRef.current) {
      flatRef.current.scrollToIndex({ index: currentIdx, animated: true });
    }
  }, [currentIdx]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const v = viewableItems[0];
    if (!v?.item) return;
    const item = v.item as Song;
    if (item.id === lastReportedId.current) return;
    lastReportedId.current = item.id;
    if (currentSong && item.id !== currentSong.id) playSong(item, queue);
  }).current;

  const rotation = useSharedValue(0);
  React.useEffect(() => {
    if (isPlaying) rotation.value = withRepeat(withTiming(360, { duration: 14000, easing: Easing.linear }), -1);
    else cancelAnimation(rotation);
    return () => cancelAnimation(rotation);
  }, [isPlaying, rotation]);
  const discStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  const coverScale = useSharedValue(1);
  React.useEffect(() => {
    coverScale.value = withTiming(isPlaying ? 1 : 0.94, { duration: 350 });
  }, [isPlaying, coverScale]);

  const accent = palette?.vibrant ?? palette?.dominant ?? theme.palette.accent;
  const accentDark = palette?.darkVibrant ?? palette?.darkMuted ?? theme.palette.backgroundDeep;
  const gradientColors = theme.gradients.nowPlayingBackdrop(accent, accentDark);

  const renderCover = useCallback(({ item }: { item: Song; index: number }) => {
    const isActive = currentSong?.id === item.id;
    return (
      <View style={styles.coverSlide}>
        <CoverArtwork song={item} isActive={isActive} isPlaying={isActive && isPlaying} discStyle={discStyle} coverScale={coverScale} accent={palette?.vibrant ?? palette?.dominant ?? accent} />
      </View>
    );
  }, [currentSong?.id, isPlaying, discStyle, coverScale, accent, palette]);

  return (
    <View style={styles.root} testID="now-playing-screen">
      <LinearGradient colors={gradientColors} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[styles.glowOrb, { backgroundColor: accent }]} />
      <BlurView intensity={theme.blur.medium} tint="dark" style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(5,6,10,0.0)', 'rgba(5,6,10,0.55)', 'rgba(5,6,10,0.95)']} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <View style={styles.headerBar}>
        <Pressable testID="now-playing-close" style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <ChevronDown color={theme.palette.text.primary} size={22} />
        </Pressable>
        <View style={{ alignItems: 'center', flex: 1 }}>
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
        contentContainerStyle={{ alignItems: 'center' }}
      />

      <View style={styles.titleRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={2}>{currentSong?.title ?? 'Kein Titel ausgewählt'}</Text>
          <Text style={styles.artist} numberOfLines={1}>{currentSong?.artist ?? 'Wähle einen Song aus der Bibliothek'}</Text>
        </View>
        <Pressable style={styles.heartBtn}><Heart color={theme.palette.text.primary} size={20} /></Pressable>
      </View>

      <View style={styles.visualizerWrap}><Visualizer bins={fftBins} active={visualizerRunning && isPlaying} color={palette?.vibrant ?? theme.palette.primary} height={44} /></View>
      <ProgressBar currentPosition={position} duration={duration} onSeek={seekTo} />
      <Controls />

      <View style={styles.bottomRow}>
        <Pressable style={styles.bottomBtn}><Heart color={theme.palette.text.muted} size={20} /></Pressable>
        <GlassCard style={styles.glassRow} intensity={theme.blur.medium}><ModernControls volume={volume} onVolumeChange={setVolume} /></GlassCard>
        <Pressable style={styles.bottomBtn}><Disc3 color={theme.palette.text.muted} size={20} /></Pressable>
      </View>
    </View>
  );
};

interface CoverProps {
  song: Song; isActive: boolean; isPlaying: boolean; discStyle: ReturnType<typeof useAnimatedStyle>; coverScale: ReturnType<typeof useSharedValue<number>>; accent: string;
}

const CoverArtwork: React.FC<CoverProps> = ({ song, isActive, isPlaying, discStyle, coverScale, accent }) => {
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(isActive ? 1 : 0, [0, 1], [0.85, coverScale.value]) }],
    opacity: withTiming(isActive ? 1 : 0.45, { duration: 240 }),
  }));
  return (
    <Animated.View style={[styles.coverCard, animated, { shadowColor: accent }]}> 
      {song.cover ? (
        <Image source={{ uri: song.cover }} style={styles.coverImage} />
      ) : (
        <Animated.View style={[styles.discFallback, isPlaying && discStyle]}>
          <Disc3 color={theme.palette.primary} size={120} />
        </Animated.View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 52, paddingBottom: 24 },
  glowOrb: { position: 'absolute', width: 340, height: 340, borderRadius: 170, top: 110, left: SCREEN_W / 2 - 170, opacity: 0.18 },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginBottom: 8 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerEyebrow: { color: theme.palette.text.muted, fontSize: 10, letterSpacing: 1.8, fontFamily: theme.fonts.body },
  headerTitle: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 14, marginTop: 2 },
  carousel: { flexGrow: 0, height: COVER_SIZE + 10 },
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
  discFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginTop: 8, marginBottom: 8 },
  titleBlock: { flex: 1 },
  title: { color: theme.palette.text.primary, fontSize: 28, letterSpacing: -0.7, fontFamily: theme.fonts.display },
  artist: { color: theme.palette.text.secondary, fontSize: 15, marginTop: 3, fontFamily: theme.fonts.body },
  heartBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  visualizerWrap: { paddingHorizontal: 20, marginTop: 4 },
  bottomRow: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  bottomBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.palette.surfaceElevated },
  glassRow: { flex: 1 },
});

export default NowPlaying;
