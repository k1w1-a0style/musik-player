import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { cancelWaveformPreparation, dismissWaveformPreparation, resumeWaveformPreparation,
  useWaveformPreparation, type WaveformPreparationState } from '../utils/libraryWaveformPreparation';
import LibraryImportStatus, { type LibraryImportStatusProps } from './LibraryImportStatus';
import { useWaveformProgress } from '../hooks/useWaveformStatus';

const LibraryPreparationStatus = ({ visible, ...props }: LibraryImportStatusProps & { visible: boolean }) => {
  const preparation = useWaveformPreparation();
  if (preparation.status === 'idle') return visible ? <LibraryImportStatus {...props} /> : null;
  return <WaveformPreparationPanel preparation={preparation} />;
};

const WaveformPreparationPanel = ({ preparation }: { preparation: WaveformPreparationState }) => {
  const { theme } = useAppTheme();
  const trackProgress = useWaveformProgress(preparation.currentFingerprint);
  const running = preparation.status === 'running';
  const resumable = preparation.status === 'cancelled' || preparation.failed > 0;
  const label = running ? 'Titel werden vorbereitet' : preparation.status === 'cancelled'
    ? 'Vorbereitung angehalten' : 'Vorbereitung abgeschlossen';
  const action = running ? cancelWaveformPreparation : resumable
    ? () => { void resumeWaveformPreparation(); } : dismissWaveformPreparation;
  return <View style={[styles.box, { backgroundColor: theme.palette.surfaceGlass,
    borderColor: theme.palette.border }]} testID="library-waveform-preparation">
    <View style={styles.row}>
      {running ? <ActivityIndicator size="small" color={theme.palette.primary} /> : null}
      <Text style={[styles.title, { color: theme.palette.text.primary }]}>{label}</Text>
      <Pressable onPress={action} accessibilityRole="button" style={styles.action}>
        <Text style={{ color: theme.palette.primary }}>{running ? 'Abbrechen' : resumable ? 'Fortsetzen' : 'Schließen'}</Text>
      </Pressable>
    </View>
    <Text style={{ color: theme.palette.text.secondary }} testID="library-waveform-preparation-counts">
      {`${preparation.processed}/${preparation.total} · ${preparation.ready} bereit · ${preparation.failed} nicht verfügbar`}
    </Text>
    <View accessible accessibilityRole="progressbar" accessibilityLabel="Waveform-Vorbereitung"
      accessibilityValue={{ min: 0, max: preparation.total, now: preparation.processed }}
      style={[styles.track, { backgroundColor: theme.palette.border }]}>
      <View style={[styles.fill, { backgroundColor: theme.palette.primary,
        width: `${preparation.total ? preparation.processed / preparation.total * 100 : 0}%` }]} />
    </View>
    {running ? <Text numberOfLines={1} style={{ color: theme.palette.text.secondary }}>{preparation.currentTitle}</Text> : null}
    {running && preparation.currentTitle ? <View accessibilityRole="progressbar"
      accessibilityLabel={`Vorbereitung von ${preparation.currentTitle}`}
      accessibilityValue={trackProgress === null ? { text: 'Wird vorbereitet' }
        : { min: 0, max: 100, now: Math.round(trackProgress * 100) }}
      style={[styles.currentTrack, { backgroundColor: theme.palette.border }]}
      testID="library-current-track-progress">
      <View style={[styles.fill, { backgroundColor: theme.palette.primary,
        width: trackProgress === null ? '25%' : `${trackProgress * 100}%` }]} />
    </View> : null}
    <Text style={[styles.legend, { color: theme.palette.text.muted }]}>Abgedunkelte Titel werden nach der Vorbereitung freigegeben.</Text>
  </View>;
};
const styles = StyleSheet.create({
  box: { marginHorizontal: 20, marginBottom: 8, padding: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, title: { flex: 1, fontSize: 12 },
  action: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 6 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' }, fill: { height: '100%' }, legend: { fontSize: 10 },
  currentTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
});
export default LibraryPreparationStatus;
