import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AudioLines, Play, SkipBack, SkipForward } from 'lucide-react-native';
import CrossfadeLayers from '../components/CrossfadeLayers';
import SoundCloudWaveformViewport from '../components/SoundCloudWaveformViewport';
import { usePlaybackProgress } from '../contexts/PlaybackProgressContext';
import { useSongWaveform } from '../hooks/useSongWaveform';
import type { Song } from '../types/Song';
import { APP_THEME_TOKENS } from '../utils/appTheme';
import { SOUNDCLOUD_PLAYER_COLORS } from '../utils/appThemeOverlays';
import { displayArtist, displayTitle } from '../utils/libraryPresentation';
import { formatTime } from '../utils/musicParser';
import { SOUNDCLOUD_WAVEFORM_POINT_COUNT } from '../utils/soundCloudPlayer';
import { normalizeWaveformPoints } from '../utils/waveformGenerator';
import type { SoundCloudCarouselPageRole } from './soundCloudCarouselTypes';

const ActiveWaveform = React.memo(({ song, isPlaying, accent, onSeek, gestureHandlerRef }: { song: Song;
  isPlaying: boolean; accent: string; onSeek: (position: number) => Promise<void>;
  gestureHandlerRef?: React.RefObject<unknown | null> }) => {
  const { position, duration } = usePlaybackProgress();
  const { waveform: source, waveformReady } = useSongWaveform({
    song, durationMs: duration, pointCount: SOUNDCLOUD_WAVEFORM_POINT_COUNT,
  });
  const waveform = useMemo(() => source.points.length === SOUNDCLOUD_WAVEFORM_POINT_COUNT ? source
    : { ...source, points: normalizeWaveformPoints(source.points, SOUNDCLOUD_WAVEFORM_POINT_COUNT) }, [source]);
  return <SoundCloudWaveformViewport waveform={waveform} ready={waveformReady}
    currentPosition={position} duration={duration}
    isPlaying={isPlaying} onSeek={onSeek} accent={accent} height={116}
    gestureHandlerRef={gestureHandlerRef} />;
});

ActiveWaveform.displayName = 'SoundCloudActiveWaveform';

const TrackMetadata = ({ song, onOpenTrackInfo }: { song: Song; onOpenTrackInfo: () => void }) => (
  <View style={styles.metadata}>
    <Text style={styles.title} numberOfLines={2}>{displayTitle(song)}</Text>
    <Text style={styles.artist} numberOfLines={1}>{displayArtist(song)}</Text>
    <Pressable style={styles.infoChip} onPress={onOpenTrackInfo} accessibilityRole="button"
      accessibilityLabel="Infos zu diesem Track" testID="soundcloud-track-info-chip">
      <AudioLines color={SOUNDCLOUD_PLAYER_COLORS.artistText} size={15} />
      <Text style={styles.infoChipText}>Infos zu diesem Track</Text>
    </Pressable>
  </View>
);

const PausedProgress = ({ accent }: { accent: string }) => {
  const { position, duration } = usePlaybackProgress();
  const ratio = duration > 0 ? Math.max(0, Math.min(1, position / duration)) : 0;
  return (
    <View style={styles.pausedProgress} testID="soundcloud-paused-progress">
      <Text style={styles.pausedTime}>{formatTime(position)}  |  {formatTime(duration)}</Text>
      <View style={styles.progressRail}>
        <CrossfadeLayers value={accent} valueKey={accent}
          testID="soundcloud-paused-progress-accent-transition" style={StyleSheet.absoluteFill}
          renderLayer={layerAccent => <View style={[styles.progressFill,
            { width: `${ratio * 100}%`, backgroundColor: layerAccent }]} />} />
      </View>
    </View>
  );
};

const runTransport = (event: GestureResponderEvent | undefined, action: () => void): void => {
  event?.stopPropagation?.();
  action();
};

interface PausedControlsProps {
  hidden: boolean;
  transition: Animated.Value;
  scale: Animated.AnimatedInterpolation<number>;
  canGoNext: boolean;
  onPrevious: () => void;
  onPlay: () => void;
  onNext: () => void;
}

const PausedControls = ({ hidden, transition, scale, canGoNext, onPrevious, onPlay, onNext }: PausedControlsProps) => (
  <Animated.View pointerEvents={hidden ? 'none' : 'box-none'} accessibilityElementsHidden={hidden}
    importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
    style={[styles.pausedControls, { opacity: transition, transform: [{ scale }] }]} testID="soundcloud-paused-controls">
    <Pressable style={styles.secondaryTransport} onPress={event => runTransport(event, onPrevious)}
      accessibilityRole="button" accessibilityLabel="Vorheriger Track" testID="soundcloud-previous-button">
      <SkipBack color={SOUNDCLOUD_PLAYER_COLORS.foreground} fill={SOUNDCLOUD_PLAYER_COLORS.foreground} size={28} />
    </Pressable>
    <Pressable style={styles.primaryTransport} onPress={event => runTransport(event, onPlay)}
      accessibilityRole="button" accessibilityLabel="Abspielen" testID="soundcloud-play-button">
      <Play color={SOUNDCLOUD_PLAYER_COLORS.foreground} fill={SOUNDCLOUD_PLAYER_COLORS.foreground} size={34} />
    </Pressable>
    <Pressable style={[styles.secondaryTransport, !canGoNext && styles.disabled]}
      onPress={event => runTransport(event, onNext)} disabled={!canGoNext} accessibilityRole="button"
      accessibilityLabel="Nächster Track" accessibilityState={{ disabled: !canGoNext }} testID="soundcloud-next-button">
      <SkipForward color={SOUNDCLOUD_PLAYER_COLORS.foreground} fill={SOUNDCLOUD_PLAYER_COLORS.foreground} size={28} />
    </Pressable>
  </Animated.View>
);

export interface SoundCloudTrackPageProps {
  song: Song;
  role: SoundCloudCarouselPageRole;
  isPlaying: boolean;
  accent: string;
  canSwipeToNext: boolean;
  topInset: number;
  bottomInset: number;
  onTogglePlayback: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (position: number) => Promise<void>;
  onOpenTrackInfo: () => void;
  waveformGestureRef?: React.RefObject<unknown | null>;
  reduceMotion?: boolean;
}

const SoundCloudTrackPage = ({ song, role, isPlaying, accent, canSwipeToNext, topInset, bottomInset,
  onTogglePlayback, onPrevious, onNext, onSeek, onOpenTrackInfo, waveformGestureRef,
  reduceMotion = false }: SoundCloudTrackPageProps) => {
  const isCurrent = role === 'current';
  const isPaused = isCurrent && !isPlaying;
  const transition = useRef(new Animated.Value(isPaused ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(transition, { toValue: isPaused ? 1 : 0, duration: reduceMotion ? 0 : 220,
      easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [isPaused, reduceMotion, transition]);
  const controlsScale = useMemo(() => transition.interpolate({ inputRange: [0, 1],
    outputRange: [0.92, 1] }), [transition]);
  return (
    <LinearGradient colors={SOUNDCLOUD_PLAYER_COLORS.pageGradient}
      locations={[0, 0.48, 1]} style={[styles.trackPage, { paddingTop: Math.max(topInset + 54, 68),
        paddingBottom: Math.max(bottomInset + 76, 88) }]} testID={`soundcloud-track-page-${role}`}>
      <TrackMetadata song={song} onOpenTrackInfo={onOpenTrackInfo} />
      <Pressable style={styles.artworkTapArea} onPress={isCurrent ? onTogglePlayback : undefined}
        disabled={!isCurrent} accessibilityRole={isCurrent ? 'button' : undefined}
        accessibilityLabel={isCurrent ? (isPlaying ? 'Pausieren' : 'Abspielen') : undefined}
        testID={isCurrent ? 'soundcloud-swipe-hitbox' : `soundcloud-${role}-page-hitbox`}>
        {isCurrent ? <><Animated.View pointerEvents="none" style={[styles.pauseDim, { opacity: transition }]}
          testID="soundcloud-pause-dim" /><PausedControls hidden={!isPaused} transition={transition}
          scale={controlsScale} canGoNext={canSwipeToNext} onPrevious={onPrevious}
          onPlay={onTogglePlayback} onNext={onNext} /></> : null}
      </Pressable>
      <View style={styles.progressArea}>{isCurrent && isPlaying
        ? <ActiveWaveform song={song} isPlaying accent={accent} onSeek={onSeek}
          gestureHandlerRef={waveformGestureRef} />
        : isCurrent ? <PausedProgress accent={accent} /> : null}</View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  trackPage: { flex: 1, paddingHorizontal: 18 },
  metadata: { height: 126, alignItems: 'flex-start', gap: 5, overflow: 'hidden', zIndex: 4 },
  title: { maxWidth: '88%', color: SOUNDCLOUD_PLAYER_COLORS.foreground,
    backgroundColor: SOUNDCLOUD_PLAYER_COLORS.titleSurface, paddingHorizontal: 8,
    paddingVertical: 4, fontSize: 18, lineHeight: 23, fontFamily: APP_THEME_TOKENS.fonts.heading },
  artist: { maxWidth: '82%', color: SOUNDCLOUD_PLAYER_COLORS.artistText,
    backgroundColor: SOUNDCLOUD_PLAYER_COLORS.artistSurface,
    paddingHorizontal: 8, paddingVertical: 3, fontSize: 14, fontFamily: APP_THEME_TOKENS.fonts.body },
  infoChip: { minHeight: 34, maxWidth: '80%', flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 10, paddingVertical: 6, backgroundColor: SOUNDCLOUD_PLAYER_COLORS.artistSurface },
  infoChipText: { color: SOUNDCLOUD_PLAYER_COLORS.artistText, fontSize: 13,
    fontFamily: APP_THEME_TOKENS.fonts.body },
  artworkTapArea: { flex: 1, marginHorizontal: -18, alignItems: 'center', justifyContent: 'center' },
  pauseDim: { ...StyleSheet.absoluteFillObject, backgroundColor: SOUNDCLOUD_PLAYER_COLORS.pauseScrim },
  pausedControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 26 },
  primaryTransport: { width: 84, height: 84, borderRadius: 42,
    backgroundColor: SOUNDCLOUD_PLAYER_COLORS.primaryControlSurface, borderWidth: StyleSheet.hairlineWidth,
    borderColor: SOUNDCLOUD_PLAYER_COLORS.primaryControlBorder, alignItems: 'center', justifyContent: 'center' },
  secondaryTransport: { width: 58, height: 58, borderRadius: 29,
    backgroundColor: SOUNDCLOUD_PLAYER_COLORS.secondaryControlSurface, borderWidth: StyleSheet.hairlineWidth,
    borderColor: SOUNDCLOUD_PLAYER_COLORS.secondaryControlBorder, alignItems: 'center', justifyContent: 'center' },
  progressArea: { height: 150, marginHorizontal: -18, justifyContent: 'flex-end' },
  pausedProgress: { minHeight: 74, justifyContent: 'center', paddingHorizontal: 36, gap: 10 },
  pausedTime: { alignSelf: 'center', color: SOUNDCLOUD_PLAYER_COLORS.foreground, fontSize: 15,
    fontVariant: ['tabular-nums'], backgroundColor: SOUNDCLOUD_PLAYER_COLORS.titleSurface,
    paddingHorizontal: 8, paddingVertical: 3 },
  progressRail: { height: 2, backgroundColor: SOUNDCLOUD_PLAYER_COLORS.waveformRest, overflow: 'hidden' },
  progressFill: { height: '100%' },
  disabled: { opacity: 0.34 },
});

export default React.memo(SoundCloudTrackPage);
