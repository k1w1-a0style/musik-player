import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { Disc3, ListMusic, Pause, Play, SkipBack, SkipForward } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMiniPlayerMusicContext } from '../contexts/MusicContext';
import { APP_THEME_TOKENS as staticTokens } from '../utils/appTheme';
import { useAppTheme } from '../contexts/AppThemeContext';
import { displayArtist, displayTitle } from '../utils/libraryPresentation';
import { getSongArtworkUri } from '../utils/songArtwork';
import { mergeNativeAndFallbackPalette } from '../utils/jsPaletteFallback';
import MiniPlayerProgress from './MiniPlayerProgress';
import { useMiniPlayerProgress } from '../hooks/useMiniPlayerProgress';
import { runPlaybackUiAction } from '../utils/playbackUiActions';
import { useWaveformPreload } from '../hooks/useWaveformPreload';
import type { Song } from '../types/Song';

const CurrentWaveformPreloader = memo(({ song }: { song: Song }) => {
  useWaveformPreload(song);
  return null;
});

CurrentWaveformPreloader.displayName = 'MiniPlayerCurrentWaveformPreloader';

export const shouldShowMiniPlayerSecondaryControls = (width: number): boolean => width >= 390;

interface MiniPlayerControlsProps {
  color: string;
  isPlaying: boolean;
  canSkipNext: boolean;
  canSkipPrevious: boolean;
  showSecondary: boolean;
  onPrevious: (event: GestureResponderEvent) => void;
  onToggle: (event: GestureResponderEvent) => void;
  onNext: (event: GestureResponderEvent) => void;
  onOpen: () => void;
}

const MiniPlayerControls = memo(({ color, isPlaying, canSkipNext, canSkipPrevious, showSecondary,
  onPrevious, onToggle, onNext, onOpen }: MiniPlayerControlsProps) => (
  <View style={styles.right}>
    {showSecondary ? <Pressable testID="mini-player-previous" accessibilityRole="button"
      accessibilityLabel="Vorheriger Titel" accessibilityState={{ disabled: !canSkipPrevious }}
      onPress={onPrevious} style={[styles.transportButton, !canSkipPrevious && styles.disabled]} hitSlop={5}>
      <SkipBack color={color} size={18} />
    </Pressable> : null}
    <Pressable testID="mini-player-play-pause" accessibilityRole="button"
      accessibilityLabel={isPlaying ? 'Pausieren' : 'Abspielen'} onPress={onToggle}
      style={styles.playBtn} hitSlop={4}>
      {isPlaying ? <Pause color={color} size={19} /> : <Play color={color} size={19} />}
    </Pressable>
    <Pressable testID="mini-player-next" accessibilityRole="button" accessibilityLabel="Nächster Titel"
      accessibilityState={{ disabled: !canSkipNext }} onPress={onNext}
      style={[styles.transportButton, !canSkipNext && styles.disabled]} hitSlop={5}>
      <SkipForward color={color} size={18} />
    </Pressable>
    {showSecondary ? <Pressable testID="mini-player-queue" accessibilityRole="button"
      accessibilityLabel="Warteschlange öffnen" style={styles.transportButton} hitSlop={5}
      onPress={event => { event.stopPropagation(); onOpen(); }}>
      <ListMusic color={color} size={19} opacity={0.85} />
    </Pressable> : null}
  </View>
));

MiniPlayerControls.displayName = 'MiniPlayerControls';

const MiniPlayerPlaybackProgress = memo(({ accent }: { accent: string }) => {
  const progress = useMiniPlayerProgress();
  return <MiniPlayerProgress progress={progress} accent={accent} />;
});

MiniPlayerPlaybackProgress.displayName = 'MiniPlayerPlaybackProgress';

const MiniPlayerComponent: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const { currentSong, isPlaying, togglePlayPause, next, previous,
    canSkipNext, canSkipPrevious, palette } = useMiniPlayerMusicContext();
  const insets = useSafeAreaInsets();
  const { theme: appTheme } = useAppTheme();
  const { width } = useWindowDimensions();
  const showSecondaryControls = shouldShowMiniPlayerSecondaryControls(width);
  const [coverFailed, setCoverFailed] = useState(false);
  const artworkUri = getSongArtworkUri(currentSong);
  const artworkSource = useMemo(() => artworkUri ? { uri: artworkUri } : null, [artworkUri]);
  const displayTitleText = currentSong ? displayTitle(currentSong) : 'Unbekannter Titel';
  const displayArtistName = currentSong ? displayArtist(currentSong) : '';
  const effectivePalette = useMemo(
    () => mergeNativeAndFallbackPalette(palette, currentSong),
    [palette, currentSong],
  );
  const coverAccent = effectivePalette.vibrant ?? appTheme.palette.primary;
  const coverAccentMuted = effectivePalette.muted ?? appTheme.palette.borderStrong;

  useEffect(() => {
    setCoverFailed(false);
  }, [currentSong?.id, artworkUri]);

  const handleTogglePlayPause = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();
    void runPlaybackUiAction('mini-toggle', togglePlayPause, { dropIfPending: true });
  }, [togglePlayPause]);

  const handlePrevious = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();
    if (!canSkipPrevious) return;
    void runPlaybackUiAction('mini-previous', previous, { dropIfPending: true });
  }, [canSkipPrevious, previous]);

  const handleNext = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();
    if (!canSkipNext) return;
    void runPlaybackUiAction('mini-next', next, { dropIfPending: true });
  }, [canSkipNext, next]);

  if (!currentSong) return null;
  const showCover = artworkSource !== null && !coverFailed;

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 12 }]} pointerEvents="box-none">
      <CurrentWaveformPreloader song={currentSong} />
      <Pressable onPress={onOpen} style={[styles.container, { backgroundColor: appTheme.palette.surfaceGlass, borderColor: coverAccentMuted }]} testID="mini-player-open" accessibilityRole="button" accessibilityLabel="Wiedergabe öffnen">
        <View style={[styles.thumb, { backgroundColor: appTheme.palette.surfaceElevated, borderColor: coverAccentMuted }]}>
          {showCover ? (
            <Image source={artworkSource!} style={styles.thumbImage} accessible={false}
              resizeMethod="resize" fadeDuration={0} onError={() => setCoverFailed(true)} />
          ) : (
            <Disc3 color={coverAccentMuted} size={18} />
          )}
        </View>

        <View style={styles.textWrap}>
          <Text numberOfLines={1} style={[styles.title, { color: appTheme.palette.text.primary }]}>
            {displayTitleText}
          </Text>
          <Text numberOfLines={1} style={[styles.artist, { color: appTheme.palette.text.secondary }]}>
            {displayArtistName}
          </Text>
        </View>

        <MiniPlayerControls color={appTheme.palette.text.primary} isPlaying={isPlaying}
          canSkipNext={canSkipNext} canSkipPrevious={canSkipPrevious} showSecondary={showSecondaryControls}
          onPrevious={handlePrevious} onToggle={handleTogglePlayPause} onNext={handleNext} onOpen={onOpen} />
        <MiniPlayerPlaybackProgress accent={coverAccent} />
      </Pressable>
    </View>
  );
};

const MiniPlayer = memo(MiniPlayerComponent);

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 50,
  },
  container: {
    height: 58,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 10,
    overflow: 'hidden',
  },
  thumb: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  textWrap: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: staticTokens.fonts.heading,
    fontSize: 14,
  },
  artist: {
    fontFamily: staticTokens.fonts.body,
    fontSize: 11,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  transportButton: { width: 32, height: 34, alignItems: 'center', justifyContent: 'center' },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.35 },
});

export default MiniPlayer;
