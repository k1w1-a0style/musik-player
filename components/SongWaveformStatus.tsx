import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Song } from '../types/Song';
import { useAppTheme } from '../contexts/AppThemeContext';
import { retrySongPreparation } from '../utils/libraryWaveformPreparation';
import { runPlaybackUiAction } from '../utils/playbackUiActions';
import type { WaveformStatus } from '../utils/waveformStatus';
import { getWaveformSourceIdentity } from '../utils/waveformGenerator';
import { useWaveformProgress } from '../hooks/useWaveformStatus';

const LABELS = { pending: 'Vorbereitung ausstehend', analyzing: 'Wird gescannt…',
  unavailable: 'Scan fehlgeschlagen' } as const;

const PendingSongScan = ({ song, status }: { song: Song; status: Exclude<WaveformStatus, 'ready'> }) => {
  const { theme } = useAppTheme();
  const progress = useWaveformProgress(getWaveformSourceIdentity(song).sourceFingerprint);
  const running = status === 'analyzing';
  const percent = running ? Math.min(99, Math.floor((progress ?? 0) * 100)) : 0;
  return <View style={styles.status} testID={`song-waveform-status-${song.id}`}>
    <View style={styles.caption}>
      <Text style={[styles.label, { color: theme.palette.text.secondary }]} numberOfLines={1}>{LABELS[status]}</Text>
      {!running ? <Pressable hitSlop={8} accessibilityRole="button"
        accessibilityLabel={`Vorbereitung für ${song.title} ${status === 'unavailable' ? 'erneut versuchen' : 'starten'}`}
        onPress={() => {
          void runPlaybackUiAction(`prepare-${song.id}`, () => retrySongPreparation(song), { dropIfPending: true });
        }}>
        <Text style={[styles.action, { color: theme.palette.primary }]}>{status === 'unavailable' ? 'Erneut' : 'Starten'}</Text>
      </Pressable> : null}
      <Text style={[styles.percent, { color: theme.palette.text.secondary }]}
        testID={`song-preparation-percent-${song.id}`}>{status === 'unavailable' ? 'Fehler' : `${percent} %`}</Text>
    </View>
    <View accessibilityRole="progressbar"
      accessibilityLabel={running ? 'Track wird vorbereitet' : 'Track wartet auf Vorbereitung'}
      accessibilityState={{ busy: running }} accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={[styles.track, { backgroundColor: theme.palette.borderStrong }]}
      testID={`song-preparation-progress-${song.id}`}>
      <View style={[styles.fill, { backgroundColor: theme.palette.primary, width: `${percent}%` }]} />
    </View>
  </View>;
};

const SongWaveformStatus = ({ song, status }: { song: Song; status: WaveformStatus }) =>
  status === 'ready' ? null : <PendingSongScan song={song} status={status} />;

const styles = StyleSheet.create({
  status: { alignSelf: 'stretch', height: 20, gap: 2, paddingTop: 3, paddingHorizontal: 2 },
  caption: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { flex: 1, fontSize: 10, lineHeight: 12 },
  action: { fontSize: 10, lineHeight: 12, fontWeight: '600' },
  percent: { fontSize: 10, lineHeight: 12, fontVariant: ['tabular-nums'], fontWeight: '600' },
  track: { height: 3, borderRadius: 1.5, overflow: 'hidden' },
  fill: { height: '100%' },
});
export default React.memo(SongWaveformStatus);
