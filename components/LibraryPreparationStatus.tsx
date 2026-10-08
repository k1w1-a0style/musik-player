import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { cancelWaveformPreparation, resumeWaveformPreparation,
  useWaveformPreparation, type WaveformPreparationState } from '../utils/libraryWaveformPreparation';
import LibraryImportStatus, { type LibraryImportStatusProps } from './LibraryImportStatus';

const LibraryPreparationStatus = ({ visible, ...props }: LibraryImportStatusProps & { visible: boolean }) => {
  const preparation = useWaveformPreparation();
  if (visible && props.scanning) return <LibraryImportStatus {...props} />;
  if (preparation.status === 'idle') return visible ? <LibraryImportStatus {...props} /> : null;
  if (preparation.status === 'completed' && preparation.failed === 0) return null;
  return <WaveformPreparationPanel preparation={preparation} />;
};

const WaveformPreparationPanel = ({ preparation }: { preparation: WaveformPreparationState }) => {
  const { theme } = useAppTheme();
  const running = preparation.status === 'running';
  const resumable = preparation.status === 'cancelled' || preparation.failed > 0;
  const label = running ? 'Medien-Scan läuft' : preparation.status === 'cancelled'
    ? 'Medien-Scan angehalten' : 'Nicht alle Titel konnten gescannt werden';
  const action = running ? cancelWaveformPreparation : () => { void resumeWaveformPreparation(); };
  return <View style={[styles.box, { backgroundColor: theme.palette.surfaceGlass,
    borderColor: theme.palette.border }]} testID="library-waveform-preparation">
    <View style={styles.row}>
      {running ? <ActivityIndicator size="small" color={theme.palette.primary} /> : null}
      <Text style={[styles.title, { color: theme.palette.text.primary }]}>{label}</Text>
      <Pressable onPress={action} accessibilityRole="button" style={styles.action}>
        <Text style={{ color: theme.palette.primary }}>{running ? 'Abbrechen' : resumable ? 'Fortsetzen' : 'Erneut'}</Text>
      </Pressable>
    </View>
  </View>;
};
const styles = StyleSheet.create({
  box: { marginHorizontal: 8, marginBottom: 8, padding: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, title: { flex: 1, fontSize: 12 },
  action: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 6 },
});
export default LibraryPreparationStatus;
