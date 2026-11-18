import React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { CircleAlert, Info } from 'lucide-react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { cancelWaveformPreparation, resumeWaveformPreparation, retrySongPreparation,
  type WaveformPreparationState } from '../utils/libraryWaveformPreparation';
import { useLibraryProcessingStatus } from '../hooks/useLibraryProcessingStatus';
import { getLibraryMenuBackdropColor } from '../utils/appThemeOverlays';
import { DEFAULT_APP_APPEARANCE } from '../utils/appTheme';
import { runPlaybackUiAction } from '../utils/playbackUiActions';
import LibraryImportStatus, { type LibraryImportStatusProps } from './LibraryImportStatus';
import LibraryScanSummary from './LibraryScanSummary';

const waveformLabel = (preparation: WaveformPreparationState): string => {
  if (preparation.status === 'running') return 'Wellenformen werden vorbereitet';
  if (preparation.status === 'cancelled') return 'Waveformanalyse angehalten';
  if (preparation.failure === 'storage') return 'Vorbereitung angehalten – Speicherzugriff fehlgeschlagen';
  return 'Waveformanalyse teilweise fehlgeschlagen';
};

const WaveformFailures = ({ failures = [] }: { failures?: WaveformPreparationState['failedSongs'] }) => {
  const { theme } = useAppTheme();
  return failures.map(({ song, reason }) => <View key={song.id} style={styles.failureRow}>
    <Text style={[styles.failureMessage, { color: theme.palette.text.secondary }]}>{`${song.title} · ${reason}`}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`Vorbereitung für ${song.title} erneut versuchen`}
      onPress={() => { void runPlaybackUiAction(`prepare-${song.id}`, () => retrySongPreparation(song), { dropIfPending: true }); }}
      style={styles.action}>
      <Text style={{ color: theme.palette.primary }}>Erneut versuchen</Text>
    </Pressable>
  </View>);
};

const WaveformPreparationPanel = ({ preparation }: { preparation: WaveformPreparationState }) => {
  const { theme } = useAppTheme();
  const running = preparation.status === 'running';
  const action = running ? cancelWaveformPreparation : () => { void resumeWaveformPreparation(); };
  return <View style={styles.section} testID="library-waveform-preparation">
    <Text style={[styles.title, { color: theme.palette.text.primary }]}>{waveformLabel(preparation)}</Text>
    <Text style={{ color: theme.palette.text.secondary }}>{`${preparation.processed}/${preparation.total} analysiert · ${preparation.failed} fehlgeschlagen`}</Text>
    {preparation.processed < preparation.total ? <Text style={{ color: theme.palette.text.secondary }}>
      {`${preparation.total - preparation.processed} offene Aufgaben`}
    </Text> : null}
    {preparation.currentTitle ? <Text style={{ color: theme.palette.text.secondary }} numberOfLines={2}>{preparation.currentTitle}</Text> : null}
    {preparation.status !== 'completed' ? <Pressable accessibilityLabel={running ? 'Waveformanalyse abbrechen' : 'Waveformanalyse fortsetzen'}
      onPress={action} accessibilityRole="button" style={styles.action}>
      <Text style={{ color: theme.palette.primary }}>{running ? 'Abbrechen' : 'Fortsetzen'}</Text>
    </Pressable> : null}
    <WaveformFailures failures={preparation.failedSongs} />
  </View>;
};

const LibraryPreparationStatus = ({ visible, onCheckSourcePermissions, ...props }: LibraryImportStatusProps & {
  visible: boolean;
  onCheckSourcePermissions?: () => void;
}) => {
  const { theme, appearance } = useAppTheme();
  const { height } = useWindowDimensions();
  const { preparation, details, setDetails, showWaveforms, running, needsAttention, show, label } = useLibraryProcessingStatus(visible, props);
  if (!show) return null;
  return <>
    <Pressable testID="library-processing-control" accessibilityRole="button" accessibilityLabel="Verarbeitungsdetails öffnen"
      hitSlop={{ left: 10, right: 10 }}
      accessibilityHint={label} accessibilityState={{ expanded: details, busy: running }} onPress={() => setDetails(true)} style={styles.control}>
      {running ? <ActivityIndicator testID="library-import-scan-animation" size={15} color={theme.palette.primary} />
        : needsAttention ? <CircleAlert size={16} color={theme.palette.warning} />
          : <Info size={15} color={theme.palette.text.secondary} />}
    </Pressable>
    {details ? <Modal transparent animationType="fade" visible onRequestClose={() => setDetails(false)}>
      <View style={[styles.backdrop, { backgroundColor: getLibraryMenuBackdropColor(appearance ?? DEFAULT_APP_APPEARANCE) }]}>
        <Pressable testID="library-processing-backdrop" accessible={false} style={StyleSheet.absoluteFill}
          onPress={() => setDetails(false)} />
        <View accessibilityViewIsModal style={[styles.sheet, { maxHeight: Math.max(160, height - 80),
          backgroundColor: theme.palette.surfaceElevated ?? theme.palette.surfaceGlass, borderColor: theme.palette.border }]}>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={[styles.title, { color: theme.palette.text.primary }]}>Scan-Details</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Verarbeitungsdetails schließen"
              onPress={() => setDetails(false)} style={styles.action}><Text style={{ color: theme.palette.primary }}>Schließen</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.details}>
            <Text style={[styles.overview, { color: needsAttention ? theme.palette.warning : theme.palette.text.secondary }]}>
              {running ? 'Verarbeitung läuft' : needsAttention ? 'Aufgaben benötigen Aufmerksamkeit' : 'Bibliothek aktuell'}
            </Text>
            {visible || props.persistenceWarning ? <LibraryImportStatus {...props} expandedByDefault /> : null}
            {showWaveforms ? <WaveformPreparationPanel preparation={preparation} /> : null}
            <LibraryScanSummary onDismiss={() => setDetails(false)} onRetry={props.onRetryScan} persistenceWarning={props.persistenceWarning} expandedByDefault />
            {onCheckSourcePermissions ? <Pressable accessibilityRole="button" style={[styles.action, styles.sourceAction]}
              onPress={() => { setDetails(false); onCheckSourcePermissions(); }}>
              <Text style={{ color: theme.palette.primary }}>Quellenzugriff prüfen</Text>
            </Pressable> : null}
          </ScrollView>
        </View>
      </View>
    </Modal> : null}
  </>;
};
const styles = StyleSheet.create({
  control: { width: 28, minHeight: 48, flexShrink: 0, justifyContent: 'center', alignItems: 'center' },
  backdrop: { flex: 1, justifyContent: 'center', padding: 16 },
  sheet: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, overflow: 'hidden' },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', paddingHorizontal: 16, gap: 8 },
  title: { flex: 1, fontSize: 16, fontWeight: '600' },
  overview: { marginHorizontal: 20, fontSize: 12 },
  details: { paddingVertical: 8, gap: 12 }, section: { marginHorizontal: 20, gap: 8 },
  action: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
  sourceAction: { marginHorizontal: 12, alignSelf: 'flex-start' },
  failureRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  failureMessage: { flexGrow: 1, flexShrink: 1, fontSize: 12 },
});
export default LibraryPreparationStatus;
