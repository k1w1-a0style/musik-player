import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Song } from '../types/Song';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { retrySongPreparation } from '../utils/libraryWaveformPreparation';
import { runPlaybackUiAction } from '../utils/playbackUiActions';
import type { WaveformStatus } from '../utils/waveformStatus';
import { getWaveformSourceIdentity } from '../utils/waveformGenerator';
import { useWaveformProgress } from '../hooks/useWaveformStatus';

const LABELS = { pending: 'Vorbereitung ausstehend', analyzing: 'Wird vorbereitet…',
  ready: 'Bereit', unavailable: 'Vorbereitung fehlgeschlagen' } as const;

const PreparationBar = ({ running, ready, color, trackColor, songId, progress }: {
  running: boolean; ready: boolean; color: string; trackColor: string; songId: string; progress: number | null;
}) => {
  const reduceMotion = useReducedMotion();
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    if (!running || reduceMotion || progress !== null) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.ease),
        useNativeDriver: true, isInteraction: false }),
      Animated.timing(pulse, { toValue: 0.4, duration: 650, easing: Easing.inOut(Easing.ease),
        useNativeDriver: true, isInteraction: false }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse, reduceMotion, running, progress]);
  return <View accessibilityRole="progressbar" accessibilityLabel={ready ? 'Track fertig gescannt' : running ? 'Track wird vorbereitet' : 'Track wartet auf Vorbereitung'}
    accessibilityState={{ busy: running }}
    accessibilityValue={progress === null ? { text: running ? 'Wird vorbereitet' : 'Ausstehend' }
      : { min: 0, max: 100, now: Math.round(progress * 100) }}
    style={[styles.track, ready && styles.readyTrack, { backgroundColor: trackColor }]}
    testID={`song-preparation-progress-${songId}`}>
    {running || ready ? <Animated.View style={[styles.fill, { backgroundColor: color,
      width: ready ? '100%' : progress === null ? '35%' : `${progress * 100}%`,
      opacity: reduceMotion || progress !== null ? 1 : pulse }]} /> : null}
  </View>;
};

const SongWaveformStatus = ({ song, status }: { song: Song; status: WaveformStatus }) => {
  const { theme } = useAppTheme();
  const progress = useWaveformProgress(getWaveformSourceIdentity(song).sourceFingerprint);
  const ready = status === 'ready';
  const running = status === 'analyzing';
  return <View style={styles.status} testID={`song-waveform-status-${song.id}`}>
    <View style={[styles.caption, ready && styles.readyCaption]}>
      <Text style={[styles.label, { color: theme.palette.text.secondary }]} numberOfLines={1}>{LABELS[status]}</Text>
      {!running && !ready ? <Pressable hitSlop={8} accessibilityRole="button"
        accessibilityLabel={`Vorbereitung für ${song.title} ${status === 'unavailable' ? 'erneut versuchen' : 'starten'}`}
        onPress={event => {
          event?.stopPropagation?.();
          void runPlaybackUiAction(`prepare-${song.id}`, () => retrySongPreparation(song), { dropIfPending: true });
        }}>
        <Text style={[styles.action, { color: theme.palette.primary }]}>{status === 'unavailable' ? 'Erneut' : 'Starten'}</Text>
      </Pressable> : null}
      <Text style={[styles.percent, { color: theme.palette.text.secondary }]}
        testID={`song-preparation-percent-${song.id}`}>{running && progress !== null
          ? `${Math.min(99, Math.floor(progress * 100))} %` : ready ? '100 %' : status === 'pending' ? '0 %' : running ? 'Scan…' : 'Fehler'}</Text>
    </View>
    <PreparationBar running={running} ready={ready} color={theme.palette.primary} trackColor={theme.palette.borderStrong}
      songId={song.id} progress={ready ? 1 : running ? progress === null ? null : Math.min(0.99, progress) : status === 'pending' ? 0 : null} />
  </View>;
};
const styles = StyleSheet.create({
  status: { alignSelf: 'stretch', gap: 3, marginTop: 5 },
  readyCaption: { opacity: 0.6 },
  readyTrack: { opacity: 0.45 },
  caption: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { flex: 1, fontSize: 10 }, action: { fontSize: 10, fontWeight: '600' },
  percent: { fontSize: 10, fontVariant: ['tabular-nums'], fontWeight: '600' },
  track: { height: 3, borderRadius: 1.5, overflow: 'hidden' },
  fill: { height: '100%', width: '100%' },
});
export default React.memo(SongWaveformStatus);
