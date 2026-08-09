import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Play, SkipBack, SkipForward } from 'lucide-react-native';
import SoundCloudWaveformViewport from '../components/SoundCloudWaveformViewport';
import { usePlaybackProgress } from '../contexts/PlaybackProgressContext';
import { useSongWaveform } from '../hooks/useSongWaveform';
import type { Song } from '../types/Song';
import { APP_THEME_TOKENS } from '../utils/appTheme';
import { SOUNDCLOUD_PLAYER_COLORS } from '../utils/appThemeOverlays';
import { displayArtist, displayTitle } from '../utils/libraryPresentation';
import { SOUNDCLOUD_WAVEFORM_POINT_COUNT } from '../utils/soundCloudPlayer';
import { buildFallbackWaveform, normalizeWaveformPoints } from '../utils/waveformGenerator';
import type { SoundCloudCarouselPageRole } from './soundCloudCarouselTypes';

const ActiveWaveform = React.memo(({ song, isPlaying, onSeek }: { song: Song; isPlaying: boolean; onSeek: (position: number) => Promise<void> }) => {
  const { position, duration } = usePlaybackProgress();
  const { waveform: source } = useSongWaveform({ song, durationMs: duration, pointCount: SOUNDCLOUD_WAVEFORM_POINT_COUNT });
  const waveform = useMemo(() => source.points.length === SOUNDCLOUD_WAVEFORM_POINT_COUNT ? source
    : { ...source, points: normalizeWaveformPoints(source.points, SOUNDCLOUD_WAVEFORM_POINT_COUNT) }, [source]);
  return <SoundCloudWaveformViewport waveform={waveform} currentPosition={position} duration={duration}
    isPlaying={isPlaying} onSeek={onSeek} accent={SOUNDCLOUD_PLAYER_COLORS.accent} height={116} />;
});

ActiveWaveform.displayName = 'SoundCloudActiveWaveform';

const AdjacentWaveform = React.memo(({ song }: { song: Song }) => {
  const duration = song.duration ?? song.audioInfo?.durationMs ?? 0;
  const waveform = useMemo(() => buildFallbackWaveform(song, duration, 80), [duration, song]);
  return <SoundCloudWaveformViewport waveform={waveform} currentPosition={0} duration={duration}
    isPlaying={false} onSeek={() => undefined} accent={SOUNDCLOUD_PLAYER_COLORS.accent} height={116} interactive={false} />;
});

AdjacentWaveform.displayName = 'SoundCloudAdjacentWaveform';

const TrackMetadata = ({ song }: { song: Song }) => (
  <View style={styles.metadata} pointerEvents="none">
    <Text style={styles.title} numberOfLines={2}>{displayTitle(song)}</Text>
    <Text style={styles.artist} numberOfLines={1}>{displayArtist(song)}</Text>
  </View>
);

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
  canSwipeToNext: boolean;
  topInset: number;
  bottomInset: number;
  onTogglePlayback: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (position: number) => Promise<void>;
}

const SoundCloudTrackPage = ({ song, role, isPlaying, canSwipeToNext, topInset, bottomInset,
  onTogglePlayback, onPrevious, onNext, onSeek }: SoundCloudTrackPageProps) => {
  const isCurrent = role === 'current';
  const transition = useRef(new Animated.Value(isCurrent && !isPlaying ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(transition, { toValue: isCurrent && !isPlaying ? 1 : 0, duration: 220,
      easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [isCurrent, isPlaying, transition]);
  const controlsScale = useMemo(() => transition.interpolate({ inputRange: [0, 1],
    outputRange: [0.92, 1] }), [transition]);
  return (
    <LinearGradient colors={SOUNDCLOUD_PLAYER_COLORS.pageGradient}
      locations={[0, 0.48, 1]} style={[styles.trackPage, { paddingTop: Math.max(topInset + 54, 68),
        paddingBottom: Math.max(bottomInset + 76, 88) }]} testID={`soundcloud-track-page-${role}`}>
      <TrackMetadata song={song} />
      <Pressable style={styles.artworkTapArea} onPress={isCurrent ? onTogglePlayback : undefined}
        disabled={!isCurrent} accessibilityRole={isCurrent ? 'button' : undefined}
        accessibilityLabel={isCurrent ? (isPlaying ? 'Pausieren' : 'Abspielen') : undefined}
        testID={isCurrent ? 'soundcloud-swipe-hitbox' : `soundcloud-${role}-page-hitbox`}>
        {isCurrent ? <><Animated.View pointerEvents="none" style={[styles.pauseDim, { opacity: transition }]}
          testID="soundcloud-pause-dim" /><PausedControls hidden={isPlaying} transition={transition}
          scale={controlsScale} canGoNext={canSwipeToNext} onPrevious={onPrevious}
          onPlay={onTogglePlayback} onNext={onNext} /></> : null}
      </Pressable>
      <View style={styles.waveformWrap}>{isCurrent
        ? <ActiveWaveform song={song} isPlaying={isPlaying} onSeek={onSeek} />
        : <AdjacentWaveform song={song} />}</View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  trackPage: { flex: 1, paddingHorizontal: 18 }, metadata: { alignItems: 'flex-start', gap: 4 },
  title: { maxWidth: '88%', color: SOUNDCLOUD_PLAYER_COLORS.foreground,
    backgroundColor: SOUNDCLOUD_PLAYER_COLORS.titleSurface, paddingHorizontal: 8,
    paddingVertical: 4, fontSize: 18, lineHeight: 23, fontFamily: APP_THEME_TOKENS.fonts.heading },
  artist: { maxWidth: '82%', color: SOUNDCLOUD_PLAYER_COLORS.artistText,
    backgroundColor: SOUNDCLOUD_PLAYER_COLORS.artistSurface,
    paddingHorizontal: 8, paddingVertical: 3, fontSize: 14, fontFamily: APP_THEME_TOKENS.fonts.body },
  artworkTapArea: { flex: 1, marginHorizontal: -18, alignItems: 'center', justifyContent: 'center' },
  pauseDim: { ...StyleSheet.absoluteFillObject, backgroundColor: SOUNDCLOUD_PLAYER_COLORS.pauseScrim },
  pausedControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 26 },
  primaryTransport: { width: 84, height: 84, borderRadius: 42,
    backgroundColor: SOUNDCLOUD_PLAYER_COLORS.primaryControlSurface, borderWidth: StyleSheet.hairlineWidth,
    borderColor: SOUNDCLOUD_PLAYER_COLORS.primaryControlBorder, alignItems: 'center', justifyContent: 'center' },
  secondaryTransport: { width: 58, height: 58, borderRadius: 29,
    backgroundColor: SOUNDCLOUD_PLAYER_COLORS.secondaryControlSurface, borderWidth: StyleSheet.hairlineWidth,
    borderColor: SOUNDCLOUD_PLAYER_COLORS.secondaryControlBorder, alignItems: 'center', justifyContent: 'center' },
  waveformWrap: { height: 142, marginHorizontal: -18, justifyContent: 'flex-end' }, disabled: { opacity: 0.34 },
});

export default React.memo(SoundCloudTrackPage);
