import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { APP_THEME_TOKENS } from '../utils/appTheme';
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
  const { theme } = useAppTheme();
  const operation = useMetadataRefreshOperation();
  const isRunning = operation.status === 'running';
  const isCancelling = operation.status === 'cancelling';
  const showResume = canResumeMetadataRefresh(operation);
  const stateLabel = STATUS_LABEL_BY_STATE[operation.status];
  const showSpinner = isRunning || isCancelling;
  const baseStatus = status ?? (stateLabel || libraryImportMessages.importRunning);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.palette.surfaceGlass,
          borderColor: theme.palette.border,
        },
      ]}
      testID="library-import-status"
    >
      <View style={styles.statusRow}>
        {showSpinner ? <ActivityIndicator color={theme.palette.primary} size="small" /> : <View style={styles.spinnerSlot} />}
        <Text style={[styles.statusText, { color: theme.palette.text.secondary }]} testID="library-import-status-text">
          {baseStatus}
        </Text>
        {isRunning && onCancelRefresh ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Aktualisierung abbrechen"
            onPress={onCancelRefresh}
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: theme.palette.error },
              pressed && styles.actionPressed,
            ]}
            disabled={isCancelling}
            testID="library-import-status-cancel"
          >
            <Text style={[styles.actionLabel, { color: theme.palette.text.onPrimary }]}>Abbrechen</Text>
          </Pressable>
        ) : null}
        {!isRunning && showResume && onResumeRefresh ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Aktualisierung fortsetzen"
            onPress={onResumeRefresh}
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: theme.palette.warning },
              pressed && styles.actionPressed,
            ]}
            testID="library-import-status-resume"
          >
            <Text style={[styles.actionLabel, { color: theme.palette.text.onPrimary }]}>Fortsetzen</Text>
          </Pressable>
        ) : null}
      </View>
      {operation.total > 0 && (isRunning || isCancelling || showResume) ? (
        <Text style={[styles.detailsText, { color: theme.palette.text.secondary }]} testID="library-import-status-counters">
          {`${operation.processed}/${operation.total} · ${operation.updated} aktualisiert · ${operation.skipped} übersprungen · ${operation.failed} fehlgeschlagen`}
        </Text>
      ) : null}
      {operation.errorDetails.length > 0 ? (
        <View style={styles.errorBlock} testID="library-import-status-errors">
          <Text style={[styles.errorTitle, { color: theme.palette.text.secondary }]}>{`${operation.errorDetails.length} Datei(en) nicht lesbar`}</Text>
          {operation.errorDetails.slice(0, 3).map(error => {
            const filename = decodeUriSegment(error.uri);
            return (
              <Text key={`${error.uri}|${error.reason}`} style={[styles.errorRow, { color: theme.palette.text.secondary }]} numberOfLines={1}>
                {`${filename} – ${error.reason}`}
              </Text>
            );
          })}
          {operation.errorDetails.length > 3 ? (
            <Text style={[styles.errorRow, { color: theme.palette.text.secondary }]}>{`… und ${operation.errorDetails.length - 3} weitere`}</Text>
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
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  spinnerSlot: { width: 16, height: 16 },
  statusText: { fontFamily: APP_THEME_TOKENS.fonts.body, fontSize: 12, flex: 1 },
  detailsText: { fontFamily: APP_THEME_TOKENS.fonts.body, fontSize: 11, opacity: 0.85 },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  actionLabel: { fontFamily: APP_THEME_TOKENS.fonts.body, fontSize: 12, fontWeight: '600' },
  actionPressed: { opacity: 0.7 },
  errorBlock: { marginTop: 2 },
  errorTitle: { fontFamily: APP_THEME_TOKENS.fonts.body, fontSize: 11, fontWeight: '600' },
  errorRow: { fontFamily: APP_THEME_TOKENS.fonts.body, fontSize: 11, opacity: 0.8 },
});

export default LibraryImportStatus;
