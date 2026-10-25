import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { APP_THEME_TOKENS } from '../utils/appTheme';
import { libraryImportMessages } from '../utils/libraryImportMessages';
import { useImportFileProgress, IMPORT_PHASE_LABELS } from '../utils/libraryImportProgress';
import {
  useMetadataRefreshOperation,
  canResumeMetadataRefresh,
  type MetadataRefreshStatus,
} from '../utils/metadataRefreshOperation';

export interface LibraryImportStatusProps {
  status?: string | null;
  scanning?: boolean;
  onCancelScan?: () => void;
  onCancelRefresh?: () => void;
  onResumeRefresh?: () => void;
  persistenceWarning?: string | null;
  onRetryPersistence?: () => void;
  onRetryScan?: () => void;
  expandedByDefault?: boolean;
}

type MetadataRefreshErrorDetail = {
  uri: string;
  reason: string;
};

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

const decodeUriSegment = (uri: string): string => {
  const segment = uri.split('/').filter(Boolean).pop() ?? uri;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

interface RefreshActionProps {
  isRunning: boolean;
  isCancelling: boolean;
  scanning: boolean;
  showResume: boolean;
  onCancelScan?: () => void;
  onCancelRefresh?: () => void;
  onResumeRefresh?: () => void;
  cancelColor: string;
  resumeColor: string;
  labelColor: string;
}

const RefreshAction = ({
  isRunning,
  isCancelling,
  scanning,
  showResume,
  onCancelScan,
  onCancelRefresh,
  onResumeRefresh,
  cancelColor,
  resumeColor,
  labelColor,
}: RefreshActionProps): React.ReactElement | null => {
  let action: {
    accessibilityLabel: string;
    backgroundColor: string;
    label: string;
    onPress: () => void;
    testID: string;
    disabled?: boolean;
  } | undefined;

  if ((isRunning || isCancelling) && onCancelRefresh) {
    action = {
      accessibilityLabel: 'Aktualisierung abbrechen',
      backgroundColor: cancelColor,
      label: 'Abbrechen',
      onPress: onCancelRefresh,
      testID: 'library-import-status-cancel',
      disabled: isCancelling,
    };
  } else if (scanning && onCancelScan) {
    action = {
      accessibilityLabel: 'Scan abbrechen',
      backgroundColor: cancelColor,
      label: 'Abbrechen',
      onPress: onCancelScan,
      testID: 'library-import-status-scan-cancel',
    };
  } else if (!isRunning && !isCancelling && !scanning && showResume && onResumeRefresh) {
    action = {
      accessibilityLabel: 'Aktualisierung fortsetzen',
      backgroundColor: resumeColor,
      label: 'Fortsetzen',
      onPress: onResumeRefresh,
      testID: 'library-import-status-resume',
    };
  }

  if (!action) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.accessibilityLabel}
      onPress={action.onPress}
      style={({ pressed }) => [
        styles.actionButton,
        { backgroundColor: action.backgroundColor },
        pressed && styles.actionPressed,
      ]}
      disabled={action.disabled}
      testID={action.testID}
    >
      <Text style={[styles.actionLabel, { color: labelColor }]}>{action.label}</Text>
    </Pressable>
  );
};

const RefreshErrors = ({
  errorDetails,
  color,
}: {
  errorDetails: readonly MetadataRefreshErrorDetail[];
  color: string;
}): React.ReactElement | null => {
  if (errorDetails.length === 0) return null;
  return (
    <View style={styles.errorBlock} testID="library-import-status-errors">
      <Text style={[styles.errorTitle, { color }]}>{`${errorDetails.length} Datei(en) nicht lesbar`}</Text>
      {errorDetails.slice(0, 3).map(error => (
        <Text
          key={`${error.uri}|${error.reason}`}
          style={[styles.errorRow, { color }]}
          numberOfLines={1}
        >
          {`${decodeUriSegment(error.uri)} – ${error.reason}`}
        </Text>
      ))}
      {errorDetails.length > 3 ? (
        <Text style={[styles.errorRow, { color }]}>{`… und ${errorDetails.length - 3} weitere`}</Text>
      ) : null}
    </View>
  );
};

const ScanFileProgress = ({ color }: { color: string }) => {
  const progress = useImportFileProgress();
  if (!progress.total) return null;
  return <View>
    {progress.phase ? <Text style={[styles.progressText, { color }]}>{IMPORT_PHASE_LABELS[progress.phase]}</Text> : null}
    <Text style={[styles.progressText, { color }]}>{`Metadaten: ${progress.processed}/${progress.total}`}</Text>
    {progress.currentTitle ? <Text style={[styles.progressText, { color }]} numberOfLines={1}>{progress.currentTitle}</Text> : null}
  </View>;
};

const PersistenceWarning = ({ warning, retry, color, actionColor }: {
  warning?: string | null; retry?: () => void; color: string; actionColor: string;
}) => warning ? <View testID="library-import-persistence-warning">
  <Text style={[styles.progressText, { color }]}>{warning}</Text>
  {retry ? <Pressable accessibilityRole="button" accessibilityLabel="Bibliothek erneut speichern"
    onPress={retry} style={styles.actionButton}>
    <Text style={[styles.actionLabel, { color: actionColor }]}>Erneut speichern</Text>
  </Pressable> : null}
</View> : null;

const LibraryImportStatus: React.FC<LibraryImportStatusProps> = ({ status, scanning = false, onCancelScan, onCancelRefresh, onResumeRefresh,
  persistenceWarning, onRetryPersistence, expandedByDefault = false }) => {
  const { theme } = useAppTheme();
  const [details, setDetails] = useState(expandedByDefault);
  const operation = useMetadataRefreshOperation();
  const isRunning = operation.status === 'running';
  const isCancelling = operation.status === 'cancelling';
  const scanActive = scanning && !isRunning && !isCancelling;
  const showResume = canResumeMetadataRefresh(operation);
  const showSpinner = scanning || isRunning || isCancelling;
  const baseStatus = status ?? persistenceWarning ?? (STATUS_LABEL_BY_STATE[operation.status] || libraryImportMessages.importRunning);

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
        {showSpinner ? <ActivityIndicator testID="library-import-scan-animation" color={theme.palette.primary} size="small" /> : <View style={styles.spinnerSlot} />}
        <Text style={[styles.statusText, { color: theme.palette.text.secondary }]} testID="library-import-status-text">
          {baseStatus}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Scan-Details" accessibilityState={{ expanded: details }}
          onPress={() => setDetails(value => !value)} style={styles.actionButton}>
          <Text style={[styles.actionLabel, { color: theme.palette.primary }]}>Details</Text>
        </Pressable>
        <RefreshAction
          isRunning={isRunning}
          isCancelling={isCancelling}
          scanning={scanActive}
          showResume={showResume}
          onCancelScan={onCancelScan}
          onCancelRefresh={onCancelRefresh}
          onResumeRefresh={onResumeRefresh}
          cancelColor={theme.palette.error}
          resumeColor={theme.palette.warning}
          labelColor={theme.palette.text.onPrimary}
        />
      </View>
      <PersistenceWarning warning={persistenceWarning} retry={onRetryPersistence}
        color={theme.palette.warning} actionColor={theme.palette.primary} />
      {!scanActive && operation.failed > 0 ? <Text style={[styles.progressText, { color: theme.palette.warning }]}>
        {`${operation.failed} Datei(en) nicht lesbar`}
      </Text> : null}
      {details && scanActive ? <ScanFileProgress color={theme.palette.text.secondary} /> : null}
      {details && !scanActive ? <View>
        <Text style={[styles.progressText, { color: theme.palette.text.secondary }]}>
          {`${operation.processed}/${operation.total} geprüft · ${operation.updated} aktualisiert · ${operation.skipped} übersprungen`}
        </Text>
        <RefreshErrors errorDetails={operation.errorDetails} color={theme.palette.text.secondary} />
      </View> : null}
    </View>
  );
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
  progressText: { fontFamily: APP_THEME_TOKENS.fonts.body, fontSize: 12 },
  actionButton: {
    minHeight: 48,
    justifyContent: 'center',
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
