import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';
import { libraryImportMessages } from '../utils/libraryImportMessages';
import {
  useMetadataRefreshOperation,
  canResumeMetadataRefresh,
  type MetadataRefreshStatus,
} from '../utils/metadataRefreshOperation';

export interface LibraryImportStatusProps {
  status?: string | null;
  onCancelRefresh?: () => void;
  onResumeRefresh?: () => void;
}

const STATUS_LABEL_BY_STATE: Record<MetadataRefreshStatus, string> = {
  idle: '',
  running: '',
  cancelling: 'Abbruch läuft …',
  cancelled: 'Aktualisierung abgebrochen',
  resumable: 'Teilfortschritt gespeichert',
  partial: 'Teilfortschritt gespeichert',
  completed: '',
  failed: 'Aktualisierung fehlgeschlagen',
};

const LibraryImportStatus: React.FC<LibraryImportStatusProps> = ({ status, onCancelRefresh, onResumeRefresh }) => {
  const operation = useMetadataRefreshOperation();
  const isRunning = operation.status === 'running';
  const isCancelling = operation.status === 'cancelling';
  const showResume = canResumeMetadataRefresh(operation);
  const stateLabel = STATUS_LABEL_BY_STATE[operation.status];
  const showSpinner = isRunning || isCancelling;
  const baseStatus = status ?? (stateLabel || libraryImportMessages.importRunning);

  return (
    <View style={styles.container} testID="library-import-status">
      <View style={styles.statusRow}>
        {showSpinner ? <ActivityIndicator color={theme.palette.primary} size="small" /> : <View style={styles.spinnerSlot} />}
        <Text style={styles.statusText} testID="library-import-status-text">{baseStatus}</Text>
        {isRunning && onCancelRefresh ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Aktualisierung abbrechen"
            onPress={onCancelRefresh}
            style={({ pressed }) => [styles.actionButton, styles.cancelButton, pressed && styles.actionPressed]}
            disabled={isCancelling}
            testID="library-import-status-cancel"
          >
            <Text style={styles.actionLabel}>Abbrechen</Text>
          </Pressable>
        ) : null}
        {!isRunning && showResume && onResumeRefresh ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Aktualisierung fortsetzen"
            onPress={onResumeRefresh}
            style={({ pressed }) => [styles.actionButton, styles.resumeButton, pressed && styles.actionPressed]}
            testID="library-import-status-resume"
          >
            <Text style={styles.actionLabel}>Fortsetzen</Text>
          </Pressable>
        ) : null}
      </View>
      {operation.total > 0 && (isRunning || isCancelling || showResume) ? (
        <Text style={styles.detailsText} testID="library-import-status-counters">
          {`${operation.processed}/${operation.total} · ${operation.updated} aktualisiert · ${operation.skipped} übersprungen · ${operation.failed} fehlgeschlagen`}
        </Text>
      ) : null}
      {operation.errorDetails.length > 0 ? (
        <View style={styles.errorBlock} testID="library-import-status-errors">
          <Text style={styles.errorTitle}>{`${operation.errorDetails.length} Datei(en) nicht lesbar`}</Text>
          {operation.errorDetails.slice(0, 3).map(error => {
            const filename = decodeUriSegment(error.uri);
            return (
              <Text key={`${error.uri}|${error.reason}`} style={styles.errorRow} numberOfLines={1}>
                {`${filename} – ${error.reason}`}
              </Text>
            );
          })}
          {operation.errorDetails.length > 3 ? (
            <Text style={styles.errorRow}>{`… und ${operation.errorDetails.length - 3} weitere`}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const decodeUriSegment = (uri: string): string => {
  const segment = uri.split('/').filter(Boolean).pop() ?? uri;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.075)',
    gap: 6,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  spinnerSlot: { width: 16, height: 16 },
  statusText: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 12, flex: 1 },
  detailsText: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 11, opacity: 0.85 },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  cancelButton: { backgroundColor: 'rgba(220, 80, 80, 0.18)' },
  resumeButton: { backgroundColor: 'rgba(255, 191, 102, 0.22)' },
  actionLabel: { color: theme.palette.text.primary, fontFamily: theme.fonts.body, fontSize: 12, fontWeight: '600' },
  actionPressed: { opacity: 0.7 },
  errorBlock: { marginTop: 2 },
  errorTitle: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 11, fontWeight: '600' },
  errorRow: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 11, opacity: 0.8 },
});

export default LibraryImportStatus;
