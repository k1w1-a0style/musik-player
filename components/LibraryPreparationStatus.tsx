import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { cancelWaveformPreparation, resumeWaveformPreparation,
  useWaveformPreparation, type WaveformPreparationState } from '../utils/libraryWaveformPreparation';
import LibraryImportStatus, { type LibraryImportStatusProps } from './LibraryImportStatus';
import LibraryScanSummary from './LibraryScanSummary';

const LibraryPreparationStatus = ({ visible, ...props }: LibraryImportStatusProps & { visible: boolean }) => {
  const preparation = useWaveformPreparation();
  const showWaveforms = preparation.status !== 'idle' && (preparation.status !== 'completed' || preparation.failed !== 0);
  return <>{visible || props.persistenceWarning ? <LibraryImportStatus {...props} /> : null}
    {showWaveforms ? <WaveformPreparationPanel preparation={preparation} /> : null}
    <LibraryScanSummary onRetry={props.onRetryScan} persistenceWarning={props.persistenceWarning} /></>;
};

const WaveformPreparationPanel = ({ preparation }: { preparation: WaveformPreparationState }) => {
  const { theme } = useAppTheme();
  const [details, setDetails] = useState(false);
  const running = preparation.status === 'running';
  const resumable = preparation.status === 'cancelled' || preparation.status === 'failed' || preparation.failed > 0;
  const label = running ? 'Scan fertig – Waveforms werden vorbereitet' : preparation.status === 'cancelled'
    ? 'Waveformanalyse angehalten' : preparation.status === 'failed'
      ? preparation.failure === 'storage' ? 'Vorbereitung angehalten – Speicherzugriff fehlgeschlagen'
        : 'Vorbereitung angehalten – Analyse fehlgeschlagen' : 'Waveformanalyse teilweise fehlgeschlagen';
  const action = running ? cancelWaveformPreparation : () => { void resumeWaveformPreparation(); };
  return <View style={[styles.box, { backgroundColor: theme.palette.surfaceGlass,
    borderColor: theme.palette.border }]} testID="library-waveform-preparation">
    <View style={styles.row}>
      {running ? <ActivityIndicator size="small" color={theme.palette.primary} /> : null}
      <Text style={[styles.title, { color: theme.palette.text.primary }]}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Waveform-Details" accessibilityState={{ expanded: details }}
        onPress={() => setDetails(value => !value)} style={styles.action}><Text style={{ color: theme.palette.primary }}>Details</Text></Pressable>
      <Pressable accessibilityLabel={running ? 'Waveformanalyse abbrechen' : 'Waveformanalyse fortsetzen'} onPress={action} accessibilityRole="button" style={styles.action}>
        <Text style={{ color: theme.palette.primary }}>{running ? 'Abbrechen' : resumable ? 'Fortsetzen' : 'Erneut'}</Text>
      </Pressable>
    </View>
    {preparation.failed > 0 ? <Text style={{ color: theme.palette.text.secondary }}>{`${preparation.failed} Analysefehler`}</Text> : null}
    {details ? <View>
      <Text style={{ color: theme.palette.text.secondary }}>{`${preparation.processed}/${preparation.total} analysiert · ${preparation.failed} fehlgeschlagen`}</Text>
      {preparation.currentTitle ? <Text style={{ color: theme.palette.text.secondary }} numberOfLines={1}>{preparation.currentTitle}</Text> : null}
    </View> : null}
  </View>;
};
const styles = StyleSheet.create({
  box: { marginHorizontal: 20, marginBottom: 8, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, title: { flex: 1, fontSize: 12 },
  action: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 6 },
});
export default LibraryPreparationStatus;
