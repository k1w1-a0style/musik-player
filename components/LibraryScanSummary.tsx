import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { dismissLibraryScan, useLibraryScanOperation, type LibraryScanStatus } from '../utils/libraryScanOperation';
import { useMetadataRefreshOperation } from '../utils/metadataRefreshOperation';

const labels: Record<LibraryScanStatus, string> = { idle: '', running: 'läuft', completed: 'abgeschlossen',
  partial: 'teilweise abgeschlossen', cancelled: 'abgebrochen', failed: 'fehlgeschlagen' };

const LibraryScanSummary = () => {
  const { theme } = useAppTheme();
  const scan = useLibraryScanOperation();
  const refresh = useMetadataRefreshOperation();
  const statistics = scan.progress?.statistics;
  if (scan.status === 'idle' || !statistics || refresh.status === 'running' || refresh.status === 'cancelling') return null;
  const title = `${scan.fullScan ? 'Vollständiger Scan' : 'Schnellscan'} – ${labels[scan.status]}`;
  const counts = `Neu: ${statistics.newCount} · Geändert: ${statistics.changedCount} · Unverändert: ${statistics.unchangedCount}`
    + ` · Ungeprüft: ${statistics.unverifiedCount} · Leseprobleme: ${statistics.errorCount}`;
  return <View style={[styles.box, { backgroundColor: theme.palette.surfaceGlass, borderColor: theme.palette.border }]}
    testID="library-scan-summary">
    <View style={styles.row}>
      <Text style={[styles.title, { color: theme.palette.text.primary }]}>{title}</Text>
      {scan.status !== 'running' ? <Pressable onPress={dismissLibraryScan} accessibilityRole="button"
        accessibilityLabel="Scan-Ergebnis ausblenden" style={styles.dismiss}>
        <Text style={{ color: theme.palette.primary }}>Schließen</Text>
      </Pressable> : null}
    </View>
    <Text style={[styles.counts, { color: theme.palette.text.secondary }]} testID="library-scan-summary-counts">{counts}</Text>
    {scan.progress ? <Text style={[styles.counts, { color: theme.palette.text.secondary }]}>
      {`${scan.progress.processed} von ${scan.progress.total} gefundenen Dateien verarbeitet`}
    </Text> : null}
    {scan.remainingCount ? <Text style={[styles.counts, { color: theme.palette.text.secondary }]}>
      {`${scan.remainingCount} Datei(en) noch nicht geprüft`}
    </Text> : null}
    {statistics.unverifiedCount > 0 ? <Text style={[styles.counts, { color: theme.palette.text.secondary }]}>
      {scan.fullScan ? 'Ungeprüft: Revision nicht sicher vergleichbar; umfasst auch neue/geänderte Dateien ohne Inhaltsprüfung.'
        : 'Ungeprüft: bekannte Dateien ohne verlässliche Änderungsdaten. Der vollständige Scan prüft den Inhalt.'}
    </Text> : null}
  </View>;
};
const styles = StyleSheet.create({
  box: { marginHorizontal: 20, marginBottom: 8, padding: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, title: { flex: 1, fontSize: 12, fontWeight: '600' },
  counts: { fontSize: 12 }, dismiss: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
});
export default LibraryScanSummary;
