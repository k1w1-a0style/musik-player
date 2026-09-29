import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Song } from '../types/Song';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { retrySongPreparation } from '../utils/libraryWaveformPreparation';
import { runPlaybackUiAction } from '../utils/playbackUiActions';
import type { WaveformStatus } from '../utils/waveformStatus';

const LABELS = { pending: 'Vorbereitung ausstehend', analyzing: 'Wird vorbereitet…',
  ready: '', unavailable: 'Vorbereitung fehlgeschlagen' } as const;

const PreparationBar = ({ running, color, trackColor, songId }: {
  running: boolean; color: string; trackColor: string; songId: string;
}) => {
  const reduceMotion = useReducedMotion();
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    if (!running || reduceMotion) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.ease),
        useNativeDriver: true, isInteraction: false }),
      Animated.timing(pulse, { toValue: 0.4, duration: 650, easing: Easing.inOut(Easing.ease),
        useNativeDriver: true, isInteraction: false }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse, reduceMotion, running]);
  return <View accessibilityRole="progressbar" accessibilityLabel={running ? 'Track wird vorbereitet' : 'Track wartet auf Vorbereitung'}
    accessibilityState={{ busy: running }} style={[styles.track, { backgroundColor: trackColor }]}
    testID={`song-preparation-progress-${songId}`}>
    {running ? <Animated.View style={[styles.fill, { backgroundColor: color, opacity: reduceMotion ? 1 : pulse }]} /> : null}
  </View>;
};

const SongWaveformStatus = ({ song, status }: { song: Song; status: WaveformStatus }) => {
  const { theme } = useAppTheme();
  if (status === 'ready') return null;
  const running = status === 'analyzing';
  return <View style={styles.status} testID={`song-waveform-status-${song.id}`}>
    <View style={styles.caption}>
      <Text style={[styles.label, { color: theme.palette.text.secondary }]} numberOfLines={1}>{LABELS[status]}</Text>
      {!running ? <Pressable hitSlop={8} accessibilityRole="button"
        accessibilityLabel={`Vorbereitung für ${song.title} ${status === 'unavailable' ? 'erneut versuchen' : 'starten'}`}
        onPress={event => {
          event?.stopPropagation?.();
          void runPlaybackUiAction(`prepare-${song.id}`, () => retrySongPreparation(song), { dropIfPending: true });
        }}>
        <Text style={[styles.action, { color: theme.palette.primary }]}>{status === 'unavailable' ? 'Erneut' : 'Starten'}</Text>
      </Pressable> : null}
    </View>
    <PreparationBar running={running} color={theme.palette.primary} trackColor={theme.palette.border} songId={song.id} />
  </View>;
};
const styles = StyleSheet.create({
  status: { alignSelf: 'stretch', gap: 3, marginTop: 2 },
  caption: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { flex: 1, fontSize: 10 }, action: { fontSize: 10, fontWeight: '600' },
  track: { height: 3, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', width: '100%' },
});
export default React.memo(SongWaveformStatus);
