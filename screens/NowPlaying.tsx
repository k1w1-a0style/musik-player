import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { Disc3 } from 'lucide-react-native';
import { useMusicContext } from '../contexts/MusicContext';
import Controls from '../components/Controls';
import ProgressBar from '../components/ProgressBar';
import ModernControls from '../components/ModernControls';
import AppBackground from '../components/AppBackground';
import GlassCard from '../components/GlassCard';
import { theme } from '../theme';

const NowPlaying: React.FC = () => {
  const {
    currentSong,
    position,
    duration,
    seekTo,
    isPlaying,
    volume,
    setVolume,
  } = useMusicContext();

  // Slow rotation while playing — only affects the placeholder disc
  const rotation = useSharedValue(0);
  React.useEffect(() => {
    if (isPlaying) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 12000, easing: Easing.linear }),
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

  return (
    <AppBackground variant="nowPlaying">
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        testID="now-playing-screen"
      >
        <Text style={styles.eyebrow}>JETZT LÄUFT</Text>

        <View style={styles.artworkWrap}>
          {currentSong?.cover ? (
            <Image
              source={{ uri: currentSong.cover }}
              style={styles.artwork}
              testID="now-playing-artwork"
            />
          ) : (
            <Animated.View
              style={[styles.artwork, styles.placeholder, discStyle]}
              testID="now-playing-artwork"
            >
              <Disc3 color={theme.palette.primary} size={120} strokeWidth={1.2} />
            </Animated.View>
          )}
        </View>

        <Text style={styles.title} numberOfLines={2} testID="now-playing-title">
          {currentSong?.title ?? 'Kein Titel ausgewählt'}
        </Text>
        <Text style={styles.artist} numberOfLines={1} testID="now-playing-artist">
          {currentSong?.artist ?? 'Wähle einen Song aus der Bibliothek'}
        </Text>
        {currentSong?.album ? (
          <Text style={styles.album} numberOfLines={1} testID="now-playing-album">
            {currentSong.album}
          </Text>
        ) : null}

        <ProgressBar currentPosition={position} duration={duration} onSeek={seekTo} />
        <Controls />

        <GlassCard style={styles.glassRow}>
          <ModernControls volume={volume} onVolumeChange={setVolume} />
        </GlassCard>
      </ScrollView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
    alignItems: 'center',
  },
  eyebrow: {
    color: theme.palette.primary,
    fontSize: 10,
    letterSpacing: 2,
    fontFamily: theme.fonts.body,
    marginBottom: theme.spacing.sm,
  },
  artworkWrap: {
    marginVertical: theme.spacing.lg,
    ...theme.shadows.glow,
  },
  artwork: {
    width: 280,
    height: 280,
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.palette.surface,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: theme.palette.text.primary,
    fontSize: 24,
    textAlign: 'center',
    fontFamily: theme.fonts.display,
    letterSpacing: -0.6,
    marginTop: theme.spacing.md,
  },
  artist: {
    color: theme.palette.text.secondary,
    fontSize: 14,
    marginTop: theme.spacing.xs,
    fontFamily: theme.fonts.body,
  },
  album: {
    color: theme.palette.text.muted,
    fontSize: 12,
    marginTop: 2,
    fontFamily: theme.fonts.body,
    letterSpacing: 0.5,
  },
  glassRow: {
    width: '100%',
    marginTop: theme.spacing.md,
  },
});

export default NowPlaying;
