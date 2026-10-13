import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { ListMusic, Pause, Play, SkipBack, SkipForward } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMiniPlayerMusicContext } from '../contexts/MusicContext';
import { APP_THEME_TOKENS as staticTokens } from '../utils/appTheme';
import { useAppTheme } from '../contexts/AppThemeContext';
import { displayArtist, displayTitle } from '../utils/libraryPresentation';
import { getArtworkSource, getSongArtworkUri, getSongArtworkRevision } from '../utils/songArtwork';
import { useArtworkThumbnail } from '../hooks/useArtworkThumbnail';
import { mergeNativeAndFallbackPalette } from '../utils/jsPaletteFallback';
import MiniPlayerProgress from './MiniPlayerProgress';
import { useMiniPlayerProgressSnapshot } from '../hooks/useMiniPlayerProgress';
import { runPlaybackUiAction } from '../utils/playbackUiActions';
import { useWaveformPreload } from '../hooks/useWaveformPreload';
import type { Song } from '../types/Song';
import type { PaletteResult } from 'expo-system-audio';
import CrossfadeLayers from './CrossfadeLayers';
import { MINI_PLAYER_BOTTOM_MARGIN, useMiniPlayerViewport } from '../contexts/MiniPlayerViewportContext';
import { useAccentPreferences } from '../contexts/AccentPreferencesContext';
import { resolveAccentColor } from '../utils/accentPreferences';

const CurrentWaveformPreloader = memo(({ song }: { song: Song }) => {
  useWaveformPreload(song);
  return null;
});

CurrentWaveformPreloader.displayName = 'MiniPlayerCurrentWaveformPreloader';

export const shouldShowMiniPlayerSecondaryControls = (width: number, fontScale = 1): boolean => width >= 390 && fontScale < 1.4;
export const getMiniPlayerMinimumHeight = (fontScale: number): number => Math.max(64, Math.ceil(31 * fontScale + 16));

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

const MiniPlayerPlaybackProgress = memo(({ accent, songId }: { accent: string; songId: string }) => {
  const progress = useMiniPlayerProgressSnapshot();
  return <MiniPlayerProgress {...progress} songId={songId} accent={accent} />;
});

MiniPlayerPlaybackProgress.displayName = 'MiniPlayerPlaybackProgress';

const MiniPlayerAccentBorder = memo(({ color, radius, testID }: { color: string; radius: number; testID: string }) => (
  <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <CrossfadeLayers value={color} valueKey={color} testID={`${testID}-transition`}
      fill
      renderLayer={layerColor => <View style={[StyleSheet.absoluteFill, styles.accentBorder,
        { borderColor: layerColor, borderRadius: radius }]} testID={`${testID}-fill`} />} />
  </View>
));

MiniPlayerAccentBorder.displayName = 'MiniPlayerAccentBorder';

const useMiniPlayerAccent = (palette: PaletteResult | null, currentSong: Song | null, primary: string, border: string) => {
  const { preferences } = useAccentPreferences();
  const effectivePalette = useMemo(() => mergeNativeAndFallbackPalette(palette, currentSong), [palette, currentSong]);
  const coverAccent = resolveAccentColor(preferences.playerAccent, effectivePalette.vibrant ?? primary);
  return { coverAccent, coverAccentMuted: preferences.playerAccent === 'cover' ? effectivePalette.muted ?? border : coverAccent };
};

const MiniPlayerComponent: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const { currentSong, isPlaying, togglePlayPause, next, previous,
    canSkipNext, canSkipPrevious, palette } = useMiniPlayerMusicContext();
  const insets = useSafeAreaInsets();
  const { theme: appTheme } = useAppTheme();
  const { width, fontScale } = useWindowDimensions();
  const { reportHeight } = useMiniPlayerViewport();
  const showSecondaryControls = shouldShowMiniPlayerSecondaryControls(width, fontScale);
  const [coverFailed, setCoverFailed] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const artworkUri = getSongArtworkUri(currentSong);
  const thumbnailUri = useArtworkThumbnail(artworkUri, 128, getSongArtworkRevision(currentSong));
  const displayArtworkUri = thumbnailFailed ? artworkUri : thumbnailUri;
  const artworkSource = useMemo(() => getArtworkSource(coverFailed ? undefined : displayArtworkUri),
    [displayArtworkUri, coverFailed]);
  const displayTitleText = currentSong ? displayTitle(currentSong) : 'Unbekannter Titel';
  const displayArtistName = currentSong ? displayArtist(currentSong) : '';
  const { coverAccent, coverAccentMuted } = useMiniPlayerAccent(palette, currentSong, appTheme.palette.primary, appTheme.palette.borderStrong);

  useEffect(() => {
    setCoverFailed(false);
    setThumbnailFailed(false);
  }, [currentSong?.id, artworkUri]);

  const hasCurrentSong = currentSong !== null;
  useEffect(() => {
    if (!hasCurrentSong) reportHeight(0);
  }, [hasCurrentSong, reportHeight]);
  // A visibility-effect cleanup can run after the new native onLayout event.
  // Clear only when hidden or unmounted, never when the player first appears.
  useEffect(() => () => reportHeight(0), [reportHeight]);

  const handleTogglePlayPause = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();
    void runPlaybackUiAction('mini-toggle', togglePlayPause, { dropIfPending: false });
  }, [togglePlayPause]);

  const handlePrevious = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();
    if (!canSkipPrevious) return;
    void runPlaybackUiAction('mini-previous', previous, { dropIfPending: false });
  }, [canSkipPrevious, previous]);

  const handleNext = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();
    if (!canSkipNext) return;
    void runPlaybackUiAction('mini-next', next, { dropIfPending: false });
  }, [canSkipNext, next]);

  if (!currentSong) return null;

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + MINI_PLAYER_BOTTOM_MARGIN }]} pointerEvents="box-none"
      onLayout={event => reportHeight(event.nativeEvent.layout.height)} testID="mini-player-viewport">
      <CurrentWaveformPreloader song={currentSong} />
      <Pressable onPress={onOpen} style={[styles.container, { backgroundColor: appTheme.palette.surfaceGlass,
        borderColor: appTheme.palette.border, minHeight: getMiniPlayerMinimumHeight(fontScale) }]} testID="mini-player-open" accessibilityRole="button"
        accessibilityLabel="Wiedergabe öffnen">
        <View style={[styles.thumb, { backgroundColor: appTheme.palette.surfaceElevated,
          borderColor: appTheme.palette.border }]}>
          <Image source={artworkSource} style={styles.thumbImage} accessible={false}
            resizeMethod="resize" fadeDuration={0}
            onError={artworkUri && !coverFailed ? () => {
              if (displayArtworkUri !== artworkUri) setThumbnailFailed(true);
              else setCoverFailed(true);
            } : undefined} />
          <MiniPlayerAccentBorder color={coverAccentMuted} radius={10} testID="mini-player-thumb-accent-border" />
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
        <MiniPlayerPlaybackProgress accent={coverAccent} songId={currentSong.id} />
        <MiniPlayerAccentBorder color={coverAccentMuted} radius={20} testID="mini-player-accent-border" />
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
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 8,
    paddingVertical: 8,
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
    lineHeight: 17,
  },
  artist: {
    fontFamily: staticTokens.fonts.body,
    fontSize: 11,
    lineHeight: 14,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  transportButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  playBtn: {
    width: 48,
    height: 48,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.35 },
  accentBorder: { borderWidth: StyleSheet.hairlineWidth },
});

export default MiniPlayer;
