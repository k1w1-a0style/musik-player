/* istanbul ignore file */
import React, { useCallback } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderHandlers,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Info, Pause, Play, SkipBack, SkipForward } from 'lucide-react-native';
import VolumeSlider from '../components/VolumeSlider';
import WaveformScrubber from '../components/WaveformScrubber';
import SoundCloudTrackCarousel from './SoundCloudTrackCarousel';
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
  previousSong?: Song | null;
  nextSong?: Song | null;
  artworkUri?: string;
  previousArtworkUri?: string;
  nextArtworkUri?: string;
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

const displayText = (value?: string | null, fallback = '') => value?.trim() || fallback;

const NowPlayingSoundCloudView: React.FC<NowPlayingSoundCloudViewProps> = ({
  currentSong,
  previousSong,
  nextSong,
  artworkUri,
  previousArtworkUri,
  nextArtworkUri,
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

  const handleNextPress = useCallback(() => {
    if (canSwipeToNext) onSwipeToNext();
  }, [canSwipeToNext, onSwipeToNext]);

  const renderOverlay = (panHandlers: GestureResponderHandlers) => (
    <LinearGradient
      colors={overlayColors.gradient}
      style={[styles.overlay, { paddingBottom: Math.max(bottomInset, APP_THEME_TOKENS.spacing.md) }]}
    >
      <View style={styles.page} testID="now-playing-soundcloud-view">
        <View style={styles.swipeHitbox} testID="soundcloud-swipe-hitbox" {...panHandlers}>
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

          <View style={styles.centerPlay}>
            {isPlaying ? (
              <Pressable
                style={styles.playHitbox}
                onPress={togglePlayback}
                accessibilityRole="button"
                accessibilityLabel="Pausieren"
                testID="soundcloud-pause-button"
              >
                <View style={[styles.playBubble, { borderColor: theme.palette.borderStrong, backgroundColor: overlayColors.playButtonBackgroundColor }]}> 
                  <Pause color={theme.palette.text.primary} fill={theme.palette.text.primary} size={30} />
                </View>
              </Pressable>
            ) : (
              <View style={styles.pausedControls}>
                <Pressable
                  style={[styles.transportButton, { borderColor: theme.palette.borderStrong, backgroundColor: overlayColors.playButtonBackgroundColor }]}
                  onPress={onSwipeToPrevious}
                  accessibilityRole="button"
                  accessibilityLabel="Vorheriger Track"
                  testID="soundcloud-previous-button"
                >
                  <SkipBack color={theme.palette.text.primary} fill={theme.palette.text.primary} size={28} />
                </Pressable>
                <Pressable
                  style={[styles.playBubble, styles.pausedPlayButton, { borderColor: theme.palette.borderStrong, backgroundColor: overlayColors.playButtonBackgroundColor }]}
                  onPress={togglePlayback}
                  accessibilityRole="button"
                  accessibilityLabel="Abspielen"
                  testID="soundcloud-play-button"
                >
                  <Play color={theme.palette.text.primary} fill={theme.palette.text.primary} size={32} />
                </Pressable>
                <Pressable
                  style={[styles.transportButton, { borderColor: theme.palette.borderStrong, backgroundColor: overlayColors.playButtonBackgroundColor }, !canSwipeToNext && styles.disabledControl]}
                  onPress={handleNextPress}
                  disabled={!canSwipeToNext}
                  accessibilityRole="button"
                  accessibilityLabel="Nächster Track"
                  accessibilityState={{ disabled: !canSwipeToNext }}
                  testID="soundcloud-next-button"
                >
                  <SkipForward color={theme.palette.text.primary} fill={theme.palette.text.primary} size={28} />
                </Pressable>
              </View>
            )}
          </View>
        </View>

        <View style={[styles.waveformBox, !isPlaying && styles.waveformBoxPaused]}>
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

  return (
    <View style={[styles.root, { backgroundColor: theme.palette.backgroundDeep }]}>
      <SoundCloudTrackCarousel
        currentSong={currentSong}
        previousSong={previousSong}
        nextSong={nextSong}
        currentArtworkUri={artworkUri}
        previousArtworkUri={previousArtworkUri}
        nextArtworkUri={nextArtworkUri}
        canSwipeToNext={canSwipeToNext}
        onSwipeToNext={onSwipeToNext}
        onSwipeToPrevious={onSwipeToPrevious}
        blurRadius={isPlaying ? 0 : 18}
      >
        {renderOverlay}
      </SoundCloudTrackCarousel>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  overlay: { flex: 1 },
  page: { flex: 1, paddingHorizontal: APP_THEME_TOKENS.spacing.md, paddingTop: APP_THEME_TOKENS.spacing.lg },
  swipeHitbox: { flex: 1 },
  metadata: { alignItems: 'flex-start', gap: 6 },
  title: { paddingHorizontal: 10, paddingVertical: 5, fontSize: 27, lineHeight: 34, fontFamily: APP_THEME_TOKENS.fonts.heading },
  artist: { paddingHorizontal: 10, paddingVertical: 4, fontSize: 22, fontFamily: APP_THEME_TOKENS.fonts.body },
  infoButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4 },
  infoText: { fontFamily: APP_THEME_TOKENS.fonts.body, fontSize: 16 },
  centerPlay: { flex: 1 },
  playHitbox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  playBubble: { width: 76, height: 76, borderRadius: 38, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  pausedControls: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: APP_THEME_TOKENS.spacing.lg },
  transportButton: { width: 58, height: 58, borderRadius: 29, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  pausedPlayButton: { width: 84, height: 84, borderRadius: 42 },
  disabledControl: { opacity: 0.38 },
  waveformBox: { marginHorizontal: -APP_THEME_TOKENS.spacing.md, marginBottom: APP_THEME_TOKENS.spacing.md },
  waveformBoxPaused: { opacity: 0.72 },
  volumeBox: { borderRadius: APP_THEME_TOKENS.borderRadius.lg, paddingHorizontal: APP_THEME_TOKENS.spacing.md, paddingVertical: APP_THEME_TOKENS.spacing.xs },
});

export default NowPlayingSoundCloudView;