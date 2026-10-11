import 'react-native-gesture-handler';
import React, { useEffect } from 'react';

import AppErrorBoundary from './components/AppErrorBoundary';
import AppProviders from './components/AppProviders';
import RootNavigator from './navigation/RootNavigator';
import ThemedStatusBar from './components/ThemedStatusBar';
import { BackupMaintenanceBoundary } from './components/BackupMaintenanceBoundary';
import {
  isTagWriteStartupTimeoutError,
  restoreAndReconcileTagWrites,
} from './utils/tagWriterRecovery';
import { startStartupTimer } from './utils/startupTiming';

const TagWriteStartupRecovery = (): React.ReactElement | null => {
  useEffect(() => {
    const finishRecoveryTiming = startStartupTimer('tag-write-recovery');
    void restoreAndReconcileTagWrites().then(() => {
      finishRecoveryTiming('ready');
    }).catch(error => {
      if (isTagWriteStartupTimeoutError(error)) {
        finishRecoveryTiming('timeout');
        console.warn('[TagWriter] Startup recovery timed out; continuing with tag writes disabled.', String(error));
        return;
      }
      finishRecoveryTiming('failed');
      console.warn('[TagWriter] Startup recovery reconciliation failed.', String(error));
    });
  }, []);
  return null;
};
export const AppContent = (): React.ReactElement => {
  return (
    <BackupMaintenanceBoundary><TagWriteStartupRecovery /><AppProviders>
      <ThemedStatusBar />
      <RootNavigator />
    </AppProviders></BackupMaintenanceBoundary>
  );
};

export default function App(): React.ReactElement {
  return (
    <AppErrorBoundary>
      <AppContent />
    </AppErrorBoundary>
  );
}
