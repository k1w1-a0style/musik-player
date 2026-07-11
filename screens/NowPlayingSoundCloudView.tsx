/* istanbul ignore file */
import React, { useCallback, useMemo } from 'react';
import {
  ImageBackground,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PanResponderGestureState,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Info, Pause, Play } from 'lucide-react-native';
import VolumeSlider from '../components/VolumeSlider';
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
  volume: number;
  onVolumeChange: (value: number) => Promise<void>;
  bottomInset: number;
}

const MIN_HORIZONTAL_SWIPE = 34;
const HORIZONTAL_DOMINANCE = 1.05;

const displayText = (value?: string | null, fallback = '') => value?.trim() || fallback;

const isHorizontalTrackSwipe = (gesture: PanResponderGestureState): boolean => {
  const absDx = Math.abs(gesture.dx);
  const absDy = Math.abs(gesture.dy);
  return absDx >= MIN_HORIZONTAL_SWIPE && absDx >= absDy * HORIZONTAL_DOMINANCE;
};

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
  volume,
  onVolumeChange,
  bottomInset,
}) => {
  const { appearance, theme } = useAppTheme();
  const { togglePlayPause } = useMusicContext();
  const { waveform } = useSongWaveform({ song: currentSong, durationMs: duration });
  const title = displayText(currentSong?.title, 'Unbekannter Titel');
  const artist = displayText(currentSong?.artist, 'Unbekannter Künstler');
  const waveformRestColor = getNowPlayingWaveformRestColor(appearance);
  const overlayColors = getNowPlayingSoundCloudOverlayColors(appearance);

  const togglePlayback = useCallback(() => {
    if (currentSong) void togglePlayPause();
  }, [currentSong, togglePlayPause]);

  const finishTrackSwipe = useCallback((gesture: PanResponderGestureState) => {
    if (!isHorizontalTrackSwipe(gesture)) return;

    if (gesture.dx < 0) {
      if (canSwipeToNext) onSwipeToNext();
    } else {
      onSwipeToPrevious();
    }
  }, [canSwipeToNext, onSwipeToNext, onSwipeToPrevious]);

  const trackSwipeResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => isHorizontalTrackSwipe(gesture),
    onMoveShouldSetPanResponderCapture: (_event, gesture) => isHorizontalTrackSwipe(gesture),
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (_event, gesture) => finishTrackSwipe(gesture),
    onPanResponderTerminate: (_event, gesture) => finishTrackSwipe(gesture),
  }), [finishTrackSwipe]);

  const inner = (
    <LinearGradient
      colors={overlayColors.gradient}
      style={[styles.overlay, { paddingBottom: Math.max(bottomInset, APP_THEME_TOKENS.spacing.md) }]}
    >
      <View style={styles.page} testID="now-playing-soundcloud-view">
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

        <View style={styles.centerPlay} {...trackSwipeResponder.panHandlers}>
          <Pressable
            style={styles.playHitbox}
            onPress={togglePlayback}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Pausieren' : 'Abspielen'}
            testID="soundcloud-play-pause-hitbox"
          >
            <View style={[styles.playBubble, { borderColor: theme.palette.borderStrong, backgroundColor: overlayColors.playButtonBackgroundColor }]}> 
              {isPlaying ? (
                <Pause color={theme.palette.text.primary} fill={theme.palette.text.primary} size={30} />
              ) : (
                <Play color={theme.palette.text.primary} fill={theme.palette.text.primary} size={30} />
              )}
            </View>
          </Pressable>
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

        <View style={[styles.volumeBox, { backgroundColor: overlayColors.infoBackgroundColor }]}> 
          <VolumeSlider volume={volume} onVolumeChange={onVolumeChange} accentColor={progressAccent} inactiveColor={waveformRestColor} />
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
  centerPlay: { flex: 1 },
  playHitbox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  playBubble: { width: 76, height: 76, borderRadius: 38, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  waveformBox: { marginHorizontal: -APP_THEME_TOKENS.spacing.md, marginBottom: APP_THEME_TOKENS.spacing.md },
  volumeBox: { borderRadius: APP_THEME_TOKENS.borderRadius.lg, paddingHorizontal: APP_THEME_TOKENS.spacing.md, paddingVertical: APP_THEME_TOKENS.spacing.xs },
});

export default NowPlayingSoundCloudView;