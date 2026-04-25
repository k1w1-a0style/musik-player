import React, { useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  FlatList,
  ViewToken,
  Pressable,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ChevronDown, Disc3, Heart, MoreHorizontal } from 'lucide-react-native';
import { useMusicContext } from '../contexts/MusicContext';
import Controls from '../components/Controls';
import ProgressBar from '../components/ProgressBar';
import ModernControls from '../components/ModernControls';
import Visualizer from '../components/Visualizer';
import GlassCard from '../components/GlassCard';
import type { Song } from '../types/Song';
import { theme } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');
const COVER_SIZE = Math.min(SCREEN_W - theme.spacing.lg * 2, 380);

const NowPlaying: React.FC = () => {
  const {
    songs,
    currentSong,
    position,
    duration,
    seekTo,
    isPlaying,
    volume,
    setVolume,
    palette,
    fftBins,
    visualizerRunning,
    playSong,
  } = useMusicContext();

  // Carousel
  const queue: Song[] = useMemo(() => {
    if (songs.length === 0 && currentSong) return [currentSong];
    return songs;
  }, [songs, currentSong]);
  const currentIdx = currentSong
    ? Math.max(0, queue.findIndex(s => s.id === currentSong.id))
    : 0;
  const flatRef = useRef<FlatList<Song>>(null);
  const lastReportedId = useRef<string | null>(currentSong?.id ?? null);

  React.useEffect(() => {
    if (currentIdx >= 0 && flatRef.current) {
      flatRef.current.scrollToIndex({ index: currentIdx, animated: true });
    }
  }, [currentIdx]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const v = viewableItems[0];
      if (!v?.item) return;
      const item = v.item as Song;
      if (item.id === lastReportedId.current) return;
      lastReportedId.current = item.id;
      // Only switch if user actually swiped (not on programmatic scroll)
      if (currentSong && item.id !== currentSong.id) {
        playSong(item, queue);
      }
    },
  ).current;

  // Disc rotation while playing (only on placeholder)
  const rotation = useSharedValue(0);
  React.useEffect(() => {
    if (isPlaying) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 14000, easing: Easing.linear }),
        -1,
      );
    } else {
      cancelAnimation(rotation);
    }
    return () => cancelAnimation(rotation);
  }, [isPlaying, rotation]);
  const discStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // Subtle scale-on-play for cover
  const coverScale = useSharedValue(1);
  React.useEffect(() => {
    coverScale.value = withTiming(isPlaying ? 1 : 0.94, { duration: 350 });
  }, [isPlaying, coverScale]);

  // Backdrop palette
  const accent = palette?.vibrant ?? palette?.dominant ?? theme.palette.accent;
  const accentDark = palette?.darkVibrant ?? palette?.darkMuted ?? theme.palette.backgroundDeep;
  const gradientColors = useMemo(
    () => [accentDark, theme.palette.background, theme.palette.background] as const,
    [accentDark],
  );

  const renderCover = useCallback(
    ({ item, index }: { item: Song; index: number }) => {
      const isActive = currentSong?.id === item.id;
      return (
        <View style={styles.coverSlide}>
          <CoverArtwork
            song={item}
            isActive={isActive}
            isPlaying={isActive && isPlaying}
            discStyle={discStyle}
            coverScale={coverScale}
            accent={accent}
          />
        </View>
      );
    },
    [currentSong?.id, isPlaying, discStyle, coverScale, accent],
  );

  return (
    <View style={styles.root} testID="now-playing-screen">
      {/* Dynamic gradient backdrop */}
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Soft glowing accent orb behind the cover */}
      <View
        pointerEvents="none"
        style={[styles.glowOrb, { backgroundColor: accent }]}
      />
      <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
      {/* Subtle vignette to keep text readable */}
      <LinearGradient
        colors={['rgba(5,6,10,0.0)', 'rgba(5,6,10,0.55)', 'rgba(5,6,10,0.95)']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.headerBar}>
        <Pressable
          testID="now-playing-close"
          accessibilityRole="button"
          accessibilityLabel="Schließen"
          style={styles.headerBtn}
        >
          <ChevronDown color={theme.palette.text.primary} size={22} />
        </Pressable>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={styles.headerEyebrow}>JETZT LÄUFT</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {currentSong?.album ?? 'Aus deiner Bibliothek'}
          </Text>
        </View>
        <Pressable
          testID="now-playing-more"
          accessibilityRole="button"
          accessibilityLabel="Mehr"
          style={styles.headerBtn}
        >
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
        initialScrollIndex={Math.max(0, currentIdx)}
        getItemLayout={(_, index) => ({
          length: SCREEN_W,
          offset: SCREEN_W * index,
          index,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
        style={styles.carousel}
        contentContainerStyle={{ alignItems: 'center' }}
        testID="now-playing-carousel"
      />

      <View style={styles.titleBlock}>
        <Text style={styles.title} numberOfLines={2} testID="now-playing-title">
          {currentSong?.title ?? 'Kein Titel ausgewählt'}
        </Text>
        <Text style={styles.artist} numberOfLines={1} testID="now-playing-artist">
          {currentSong?.artist ?? 'Wähle einen Song aus der Bibliothek'}
        </Text>
      </View>

      <View style={styles.visualizerWrap}>
        <Visualizer
          bins={fftBins}
          active={visualizerRunning && isPlaying}
          color={accent}
          height={44}
        />
      </View>

      <ProgressBar currentPosition={position} duration={duration} onSeek={seekTo} />
      <Controls />

      <View style={styles.bottomRow}>
        <Pressable
          testID="now-playing-fav"
          accessibilityRole="button"
          accessibilityLabel="Als Favorit markieren"
          style={styles.bottomBtn}
        >
          <Heart color={theme.palette.text.muted} size={20} />
        </Pressable>
        <GlassCard style={styles.glassRow} intensity={30}>
          <ModernControls volume={volume} onVolumeChange={setVolume} />
        </GlassCard>
        <Pressable
          testID="now-playing-disc"
          accessibilityRole="button"
          accessibilityLabel="Ausgabegerät"
          style={styles.bottomBtn}
        >
          <Disc3 color={theme.palette.text.muted} size={20} />
        </Pressable>
      </View>
    </View>
  );
};

interface CoverProps {
  song: Song;
  isActive: boolean;
  isPlaying: boolean;
  discStyle: ReturnType<typeof useAnimatedStyle>;
  coverScale: ReturnType<typeof useSharedValue<number>>;
  accent: string;
}

const CoverArtwork: React.FC<CoverProps> = ({
  song,
  isActive,
  isPlaying: _playing,
  discStyle,
  coverScale,
  accent,
}) => {
  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: isActive ? coverScale.value : 0.86 }],
    opacity: isActive ? 1 : 0.5,
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(coverScale.value, [0.94, 1], [0.0, 0.55]),
  }));
  return (
    <Animated.View style={[styles.coverOuter, wrapStyle]}>
      <Animated.View
        style={[
          styles.coverGlow,
          { backgroundColor: accent, shadowColor: accent },
          glowStyle,
        ]}
        pointerEvents="none"
      />
      {song.cover ? (
        <Image source={{ uri: song.cover }} style={styles.coverImage} />
      ) : (
        <Animated.View style={[styles.coverImage, styles.coverPlaceholder, discStyle]}>
          <Disc3 color={accent} size={140} strokeWidth={1.1} />
        </Animated.View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.palette.background },
  glowOrb: {
    position: 'absolute',
    top: 100,
    left: SCREEN_W / 2 - 200,
    width: 400,
    height: 400,
    borderRadius: 200,
    opacity: 0.35,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: theme.borderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.palette.surfaceGlass,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  headerEyebrow: {
    color: theme.palette.text.muted,
    fontSize: 9,
    letterSpacing: 2.2,
    fontFamily: theme.fonts.body,
  },
  headerTitle: {
    color: theme.palette.text.primary,
    fontSize: 13,
    fontFamily: theme.fonts.heading,
    letterSpacing: -0.2,
    marginTop: 2,
    maxWidth: SCREEN_W - 120,
  },
  carousel: { flexGrow: 0 },
  coverSlide: {
    width: SCREEN_W,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.lg,
  },
  coverOuter: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: theme.borderRadius.xl,
  },
  coverGlow: {
    position: 'absolute',
    top: -24,
    left: -24,
    right: -24,
    bottom: -24,
    borderRadius: theme.borderRadius.xl + 24,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 60,
    elevation: 30,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.palette.surface,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  title: {
    color: theme.palette.text.primary,
    fontSize: 26,
    textAlign: 'center',
    fontFamily: theme.fonts.display,
    letterSpacing: -0.7,
  },
  artist: {
    color: theme.palette.text.secondary,
    fontSize: 14,
    marginTop: 4,
    fontFamily: theme.fonts.body,
  },
  visualizerWrap: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    width: '100%',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  bottomBtn: {
    width: 38,
    height: 38,
    borderRadius: theme.borderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.palette.surfaceGlass,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  glassRow: { flex: 1 },
});

export default NowPlaying;
