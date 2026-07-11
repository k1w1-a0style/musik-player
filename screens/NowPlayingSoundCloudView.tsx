/* istanbul ignore file */
import React, { useCallback, useRef } from 'react';
import {
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Info, Pause, Play } from 'lucide-react-native';
import WaveformScrubber from '../components/WaveformScrubber';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useMusicContext } from '../contexts/MusicContext';
import { useSongWaveform } from '../hooks/useSongWaveform';
import type { Song } from '../types/Song';
import { APP_THEME_TOKENS } from '../utils/appTheme';
import {
  getNowPlayingSoundCloudOverlayColors,
  getNowPlayingWaveformRestColor,
} from '../utils/appThemeOverlays';

interface NowPlayingSoundCloudViewProps {
  currentSong: Song | null;
  artworkUri?: string;
  isPlaying: boolean;
  position: number;
  duration: number;
  onSeek: (position: number) => Promise<void>;
  onSwipeToNext: () => void;
  onSwipeToPrevious: () => void;
  canSwipeToNext?: boolean;
  onOpenTrackInfo: () => void;
  progressAccent: string;
  bottomInset: number;
}

const MIN_HORIZONTAL_SWIPE = 40;
const HORIZONTAL_DOMINANCE = 1.1;
const MAX_TAP_DRIFT = 12;

const displayText = (value?: string | null, fallback = '') => value?.trim() || fallback;

const NowPlayingSoundCloudView: React.FC<NowPlayingSoundCloudViewProps> = ({
  currentSong,
  artworkUri,
  isPlaying,
  position,
  duration,
  onSeek,
  onSwipeToNext,
  onSwipeToPrevious,
  canSwipeToNext = true,
  onOpenTrackInfo,
  progressAccent,
  bottomInset,
}) => {
  const { appearance, theme } = useAppTheme();
  const { togglePlayPause } = useMusicContext();
  const { waveform } = useSongWaveform({ song: currentSong, durationMs: duration });
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const title = displayText(currentSong?.title, 'Unbekannter Titel');
  const artist = displayText(currentSong?.artist, 'Unbekannter Künstler');
  const waveformRestColor = getNowPlayingWaveformRestColor(appearance);
  const overlayColors = getNowPlayingSoundCloudOverlayColors(appearance);

  const togglePlayback = useCallback(() => {
    if (currentSong) void togglePlayPause();
  }, [currentSong, togglePlayPause]);

  const rememberStart = useCallback((event: GestureResponderEvent) => {
    startRef.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
  }, []);

  const finishInteraction = useCallback((event: GestureResponderEvent) => {
    const start = startRef.current;
    startRef.current = null;
    if (!start) return;

    const dx = event.nativeEvent.pageX - start.x;
    const dy = event.nativeEvent.pageY - start.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx <= MAX_TAP_DRIFT && absDy <= MAX_TAP_DRIFT) {
      togglePlayback();
      return;
    }

    if (absDx < MIN_HORIZONTAL_SWIPE || absDx < absDy * HORIZONTAL_DOMINANCE) return;

    if (dx < 0) {
      if (canSwipeToNext) onSwipeToNext();
    } else {
      onSwipeToPrevious();
    }
  }, [canSwipeToNext, onSwipeToNext, onSwipeToPrevious, togglePlayback]);

  const inner = (
    <LinearGradient
      colors={overlayColors.gradient}
      style={[styles.overlay, { paddingBottom: Math.max(bottomInset, APP_THEME_TOKENS.spacing.md) }]}
    >
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pausieren' : 'Abspielen'}
        style={styles.page}
        testID="now-playing-soundcloud-view"
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={event => {
          const start = startRef.current;
          if (!start) return false;
          const dx = Math.abs(event.nativeEvent.pageX - start.x);
          const dy = Math.abs(event.nativeEvent.pageY - start.y);
          return dx > 12 && dx > dy;
        }}
        onResponderGrant={rememberStart}
        onResponderRelease={finishInteraction}
        onResponderTerminate={() => { startRef.current = null; }}
      >
        <View style={styles.metadata} pointerEvents="box-none">
          <Text style={[styles.title, { color: theme.palette.text.primary, backgroundColor: overlayColors.titleBackgroundColor }]} numberOfLines={2}>{title}</Text>
          <Text style={[styles.artist, { color: theme.palette.text.secondary, backgroundColor: overlayColors.artistBackgroundColor }]} numberOfLines={1}>{artist}</Text>
          <Pressable
            style={[styles.infoButton, { backgroundColor: overlayColors.infoBackgroundColor }]}
            onPress={onOpenTrackInfo}
            accessibilityRole="button"
            accessibilityLabel="Infos zu diesem Track"
            testID="soundcloud-track-info"
          >
            <Info color={theme.palette.text.secondary} size={16} />
            <Text style={[styles.infoText, { color: theme.palette.text.secondary }]}>Infos zu diesem Track</Text>
          </Pressable>
        </View>

        <View style={styles.centerPlay} pointerEvents="none">
          <View style={[styles.playBubble, { borderColor: theme.palette.borderStrong, backgroundColor: overlayColors.playButtonBackgroundColor }]}> 
            {isPlaying ? (
              <Pause color={theme.palette.text.primary} fill={theme.palette.text.primary} size={30} />
            ) : (
              <Play color={theme.palette.text.primary} fill={theme.palette.text.primary} size={30} />
            )}
          </View>
        </View>

        <View style={styles.waveformBox}>
          <WaveformScrubber
            waveform={waveform}
            currentPosition={position}
            duration={duration}
            onSeek={onSeek}
            accent={progressAccent}
            restColor={waveformRestColor}
            height={116}
          />
        </View>
      </View>
    </LinearGradient>
  );

  if (artworkUri) {
    return (
      <ImageBackground source={{ uri: artworkUri }} resizeMode="cover" style={styles.root} imageStyle={styles.image}>
        {inner}
      </ImageBackground>
    );
  }

  return <View style={[styles.root, { backgroundColor: theme.palette.backgroundDeep }]}>{inner}</View>;
};

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  image: { opacity: 0.98 },
  overlay: { flex: 1 },
  page: { flex: 1, paddingHorizontal: APP_THEME_TOKENS.spacing.md, paddingTop: APP_THEME_TOKENS.spacing.lg },
  metadata: { alignItems: 'flex-start', gap: 6 },
  title: { paddingHorizontal: 10, paddingVertical: 5, fontSize: 27, lineHeight: 34, fontFamily: APP_THEME_TOKENS.fonts.heading },
  artist: { paddingHorizontal: 10, paddingVertical: 4, fontSize: 22, fontFamily: APP_THEME_TOKENS.fonts.body },
  infoButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4 },
  infoText: { fontFamily: APP_THEME_TOKENS.fonts.body, fontSize: 16 },
  centerPlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  playBubble: { width: 76, height: 76, borderRadius: 38, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  waveformBox: { marginHorizontal: -APP_THEME_TOKENS.spacing.md, marginBottom: APP_THEME_TOKENS.spacing.xl },
});

export default NowPlayingSoundCloudView;
