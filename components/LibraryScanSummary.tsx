import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { dismissLibraryScan, useLibraryScanOperation, type LibraryScanStatus } from '../utils/libraryScanOperation';
import type { LibraryScanOperation } from '../utils/libraryScanOperation';
import { useMetadataRefreshOperation } from '../utils/metadataRefreshOperation';
import { IMPORT_PHASE_LABELS } from '../utils/libraryImportProgress';

const labels: Record<LibraryScanStatus, string> = { idle: '', running: 'läuft', completed: 'abgeschlossen',
  partial: 'teilweise abgeschlossen', cancelled: 'abgebrochen', failed: 'fehlgeschlagen' };

const ScanFolderWarning = ({ warning, running, textColor, actionColor }: {
  warning: LibraryScanOperation['folderPersistenceWarning']; running: boolean; textColor: string; actionColor: string;
}) => warning ? <View>
  <Text style={[styles.counts, { color: textColor }]}>{warning.message}</Text>
  <Pressable accessibilityRole="button" accessibilityLabel="Ordnerdaten erneut speichern"
    disabled={warning.retrying || running} onPress={() => { void warning.retry(); }} style={styles.dismiss}>
    <Text style={{ color: actionColor }}>{warning.retrying ? 'Schreibvorgang läuft noch…' : 'Ordnerdaten erneut speichern'}</Text>
  </Pressable>
</View> : null;

const ScanDetails = ({ scan, color }: { scan: LibraryScanOperation; color: string }) => {
  const statistics = scan.progress?.statistics;
  const counts = statistics ? `Neu: ${statistics.newCount} · Geändert: ${statistics.changedCount} · Unverändert: ${statistics.unchangedCount}`
    + ` · Ungeprüft: ${statistics.unverifiedCount} · Leseprobleme: ${statistics.errorCount}` : undefined;
  return <View style={styles.details}>
    {counts ? <Text style={[styles.counts, { color }]} testID="library-scan-summary-counts">{counts}</Text> : null}
    {scan.diagnostics ? <Text style={[styles.counts, { color }]}>{`${scan.diagnostics.importedCount} Titel eingelesen · ${scan.diagnostics.fileErrorCount} Dateiprobleme · ${statistics?.duplicateCount ?? 0} doppelte Quellen übersprungen`}</Text> : null}
    {scan.progress ? <Text style={[styles.counts, { color }]}>
      {`${scan.progress.processed} von ${scan.progress.total} gefundenen Dateien verarbeitet`}
    </Text> : null}
    {statistics && statistics.unverifiedCount > 0 ? <Text style={[styles.counts, { color }]}>
      {scan.fullScan ? 'Ungeprüft: Revision nicht sicher vergleichbar; umfasst auch neue/geänderte Dateien ohne Inhaltsprüfung.'
        : 'Ungeprüft: bekannte Dateien ohne verlässliche Änderungsdaten. Der vollständige Scan prüft den Inhalt.'}
    </Text> : null}
    {scan.errorDetails?.map((detail, index) => <Text key={`${detail.uri}-${index}`} style={[styles.counts, { color }]}>
      {`${IMPORT_PHASE_LABELS[detail.phase]} · ${detail.code}: ${detail.message}`}
    </Text>)}
  </View>;
};

const canAutoDismiss = (scan: LibraryScanOperation): boolean => {
  const progress = scan.progress;
  const statistics = progress?.statistics;
  return scan.status === 'completed' && Boolean(progress && statistics)
    && progress?.processed === progress?.total && !scan.remainingCount && !scan.folderPersistenceWarning
    && statistics?.errorCount === 0 && statistics?.unverifiedCount === 0;
};
const shouldShowSummary = (scan: LibraryScanOperation, refreshStatus: string): boolean =>
  scan.status !== 'idle' && scan.status !== 'running'
    && Boolean(scan.errorMessage || scan.progress?.statistics || scan.folderPersistenceWarning || scan.status === 'failed' || scan.status === 'cancelled')
    && refreshStatus !== 'running' && refreshStatus !== 'cancelling';

const scanIssues = (scan: LibraryScanOperation): string => {
  if (scan.diagnostics?.directoryErrorCount) return `${scan.diagnostics.directoryErrorCount} Ordnerproblem(e) · Inhalt nicht vollständig erfasst · ${scan.diagnostics.fileErrorCount} Dateiproblem(e)`;
  const statistics = scan.progress?.statistics;
  return statistics ? `${statistics.unverifiedCount} ungeprüft · ${statistics.errorCount} Leseprobleme` : '';
};

const LibraryScanSummary = ({ onRetry, persistenceWarning, expandedByDefault = false }: {
  onRetry?: () => void; persistenceWarning?: string | null; expandedByDefault?: boolean;
}) => {
  const { theme } = useAppTheme();
  const scan = useLibraryScanOperation();
  const refresh = useMetadataRefreshOperation();
  // Key the expanded state to the operation so a new scan starts compact.
  const [expandedId, setExpandedId] = useState<number | null>(expandedByDefault ? scan.id : null);
  const details = expandedId === scan.id;
  const statistics = scan.progress?.statistics;
  const warning = scan.folderPersistenceWarning;
  const cleanSuccess = canAutoDismiss(scan) && !persistenceWarning;
  useEffect(() => {
    if (!cleanSuccess || details) return;
    const timer = setTimeout(dismissLibraryScan, 4000);
    return () => clearTimeout(timer);
  }, [cleanSuccess, details, scan.id]);
  if (!shouldShowSummary(scan, refresh.status)) return null;
  const title = `${scan.fullScan ? 'Vollständiger Scan' : 'Schnellscan'} – ${labels[scan.status]}`;
  const issues = scanIssues(scan);
  return <View style={[styles.box, { backgroundColor: theme.palette.surfaceGlass, borderColor: theme.palette.border }]}
    testID="library-scan-summary">
    <View style={styles.row}>
      <Text style={[styles.title, { color: theme.palette.text.primary }]}>{title}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Scan-Ergebnisdetails" accessibilityState={{ expanded: details }}
        onPress={() => setExpandedId(details ? null : scan.id)} style={styles.dismiss}>
        <Text style={{ color: theme.palette.primary }}>Details</Text>
      </Pressable>
      <Pressable onPress={dismissLibraryScan} accessibilityRole="button"
        accessibilityLabel="Scan-Ergebnis ausblenden" style={styles.dismiss}>
        <Text style={{ color: theme.palette.primary }}>Schließen</Text>
      </Pressable>
    </View>
    {scan.errorMessage ? <Text accessibilityRole="alert" testID="library-scan-summary-error"
      style={[styles.counts, { color: theme.palette.text.secondary }]}>{scan.errorMessage}</Text> : null}
    {!cleanSuccess && issues ? <Text style={[styles.counts, { color: theme.palette.text.secondary }]}>{issues}</Text> : null}
    {statistics && statistics.errorCount > 0 ? <Text style={[styles.counts, { color: theme.palette.text.secondary }]}>
      Nicht lesbare Scan-Ordner kannst du unter „Scan-Ordner“ mit „Zugriff erneuern“ wieder freigeben.
    </Text> : null}
    {scan.remainingCount ? <Text style={[styles.counts, { color: theme.palette.text.secondary }]}>
      {`${scan.remainingCount} Datei(en) noch nicht geprüft`}
    </Text> : null}
    {details ? <ScanDetails scan={scan} color={theme.palette.text.secondary} /> : null}
    <ScanFolderWarning warning={warning} running={false} textColor={theme.palette.text.secondary} actionColor={theme.palette.primary} />
    {!cleanSuccess && onRetry ? <Pressable accessibilityRole="button" accessibilityLabel="Scan erneut versuchen"
      onPress={onRetry} style={styles.dismiss}><Text style={{ color: theme.palette.primary }}>Erneut prüfen</Text></Pressable> : null}
  </View>;
};
const styles = StyleSheet.create({
  box: { marginHorizontal: 20, marginBottom: 8, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, gap: 6 },
  row: { flexWrap: 'wrap', flexDirection: 'row', alignItems: 'center', gap: 8 }, title: { flex: 1, fontSize: 12, fontWeight: '600' },
  details: { gap: 4 },
  counts: { fontSize: 12 }, dismiss: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
});
export default LibraryScanSummary;
