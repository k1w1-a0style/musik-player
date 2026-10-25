import React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { cancelWaveformPreparation, resumeWaveformPreparation,
  type WaveformPreparationState } from '../utils/libraryWaveformPreparation';
import { useLibraryProcessingStatus } from '../hooks/useLibraryProcessingStatus';
import LibraryImportStatus, { type LibraryImportStatusProps } from './LibraryImportStatus';
import LibraryScanSummary from './LibraryScanSummary';

const waveformLabel = (preparation: WaveformPreparationState): string => {
  if (preparation.status === 'running') return 'Wellenformen werden vorbereitet';
  if (preparation.status === 'cancelled') return 'Waveformanalyse angehalten';
  if (preparation.failure === 'storage') return 'Vorbereitung angehalten – Speicherzugriff fehlgeschlagen';
  return 'Waveformanalyse teilweise fehlgeschlagen';
};

const WaveformPreparationPanel = ({ preparation }: { preparation: WaveformPreparationState }) => {
  const { theme } = useAppTheme();
  const running = preparation.status === 'running';
  const action = running ? cancelWaveformPreparation : () => { void resumeWaveformPreparation(); };
  return <View style={styles.section} testID="library-waveform-preparation">
    <Text style={[styles.title, { color: theme.palette.text.primary }]}>{waveformLabel(preparation)}</Text>
    <Text style={{ color: theme.palette.text.secondary }}>{`${preparation.processed}/${preparation.total} analysiert · ${preparation.failed} fehlgeschlagen`}</Text>
    {preparation.currentTitle ? <Text style={{ color: theme.palette.text.secondary }} numberOfLines={2}>{preparation.currentTitle}</Text> : null}
    <Pressable accessibilityLabel={running ? 'Waveformanalyse abbrechen' : 'Waveformanalyse fortsetzen'}
      onPress={action} accessibilityRole="button" style={styles.action}>
      <Text style={{ color: theme.palette.primary }}>{running ? 'Abbrechen' : 'Fortsetzen'}</Text>
    </Pressable>
  </View>;
};

const LibraryPreparationStatus = ({ visible, ...props }: LibraryImportStatusProps & { visible: boolean }) => {
  const { theme } = useAppTheme();
  const { height } = useWindowDimensions();
  const { preparation, details, setDetails, showWaveforms, running, needsAttention, show, label } = useLibraryProcessingStatus(visible, props);
  if (!show) return null;
  return <>
    <Pressable testID="library-processing-control" accessibilityRole="button" accessibilityLabel="Verarbeitungsdetails öffnen"
      accessibilityHint={label} accessibilityState={{ expanded: details }} onPress={() => setDetails(true)} style={styles.control}>
      {running ? <ActivityIndicator testID="library-import-scan-animation" size="small" color={theme.palette.primary} /> : null}
      <Text testID="library-processing-label" style={[styles.label, { color: needsAttention ? theme.palette.warning : theme.palette.text.secondary }]}>
        {needsAttention ? 'ⓘ ' : ''}{label}
      </Text>
      <Text style={{ color: theme.palette.primary }}>›</Text>
    </Pressable>
    {details ? <Modal transparent animationType="fade" visible onRequestClose={() => setDetails(false)}>
      <View style={styles.backdrop}>
        <Pressable testID="library-processing-backdrop" accessible={false} style={StyleSheet.absoluteFill}
          onPress={() => setDetails(false)} />
        <View accessibilityViewIsModal style={[styles.sheet, { maxHeight: Math.max(160, height - 80),
          backgroundColor: theme.palette.surfaceElevated ?? theme.palette.surfaceGlass, borderColor: theme.palette.border }]}>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={[styles.title, { color: theme.palette.text.primary }]}>Bibliotheksaktivität</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Verarbeitungsdetails schließen"
              onPress={() => setDetails(false)} style={styles.action}><Text style={{ color: theme.palette.primary }}>Schließen</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.details}>
            {visible || props.persistenceWarning ? <LibraryImportStatus {...props} expandedByDefault /> : null}
            {showWaveforms ? <WaveformPreparationPanel preparation={preparation} /> : null}
            <LibraryScanSummary onRetry={props.onRetryScan} persistenceWarning={props.persistenceWarning} expandedByDefault />
          </ScrollView>
        </View>
      </View>
    </Modal> : null}
  </>;
};
const styles = StyleSheet.create({
  control: { minHeight: 48, marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { flex: 1, fontSize: 12 },
  backdrop: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, overflow: 'hidden' },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', paddingHorizontal: 16, gap: 8 },
  title: { flex: 1, fontSize: 16, fontWeight: '600' },
  details: { paddingVertical: 8, gap: 12 }, section: { marginHorizontal: 20, gap: 8 },
  action: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
});
export default LibraryPreparationStatus;
