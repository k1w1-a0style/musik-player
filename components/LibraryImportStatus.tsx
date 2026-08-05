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
  showResume: boolean;
  onCancelRefresh?: () => void;
  onResumeRefresh?: () => void;
  cancelColor: string;
  resumeColor: string;
  labelColor: string;
}

const RefreshAction = ({
  isRunning,
  isCancelling,
  showResume,
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

  if (isRunning && onCancelRefresh) {
    action = {
      accessibilityLabel: 'Aktualisierung abbrechen',
      backgroundColor: cancelColor,
      label: 'Abbrechen',
      onPress: onCancelRefresh,
      testID: 'library-import-status-cancel',
      disabled: isCancelling,
    };
  } else if (!isRunning && showResume && onResumeRefresh) {
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

interface RefreshCountersProps {
  visible: boolean;
  processed: number;
  total: number;
  updated: number;
  skipped: number;
  failed: number;
  color: string;
}

const RefreshCounters = ({
  visible,
  processed,
  total,
  updated,
  skipped,
  failed,
  color,
}: RefreshCountersProps): React.ReactElement | null => {
  if (!visible || total <= 0) return null;
  return (
    <Text style={[styles.detailsText, { color }]} testID="library-import-status-counters">
      {`${processed}/${total} · ${updated} aktualisiert · ${skipped} übersprungen · ${failed} fehlgeschlagen`}
    </Text>
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

const LibraryImportStatus: React.FC<LibraryImportStatusProps> = ({ status, onCancelRefresh, onResumeRefresh }) => {
  const { theme } = useAppTheme();
  const operation = useMetadataRefreshOperation();
  const isRunning = operation.status === 'running';
  const isCancelling = operation.status === 'cancelling';
  const showResume = canResumeMetadataRefresh(operation);
  const showSpinner = isRunning || isCancelling;
  const baseStatus = status ?? (STATUS_LABEL_BY_STATE[operation.status] || libraryImportMessages.importRunning);

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
        <RefreshAction
          isRunning={isRunning}
          isCancelling={isCancelling}
          showResume={showResume}
          onCancelRefresh={onCancelRefresh}
          onResumeRefresh={onResumeRefresh}
          cancelColor={theme.palette.error}
          resumeColor={theme.palette.warning}
          labelColor={theme.palette.text.onPrimary}
        />
      </View>
      <RefreshCounters
        visible={isRunning || isCancelling || showResume}
        processed={operation.processed}
        total={operation.total}
        updated={operation.updated}
        skipped={operation.skipped}
        failed={operation.failed}
        color={theme.palette.text.secondary}
      />
      <RefreshErrors errorDetails={operation.errorDetails} color={theme.palette.text.secondary} />
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
