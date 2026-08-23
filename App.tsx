import 'react-native-gesture-handler';
import React, { useEffect } from 'react';

import AppErrorBoundary from './components/AppErrorBoundary';
import AppProviders from './components/AppProviders';
import RootNavigator from './navigation/RootNavigator';
import ThemedStatusBar from './components/ThemedStatusBar';
import {
  isTagWriteStartupTimeoutError,
  restoreAndReconcileTagWrites,
} from './utils/tagWriterRecovery';
import { startStartupTimer } from './utils/startupTiming';

export const AppContent = (): React.ReactElement => {
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

  return (
    <AppProviders>
      <ThemedStatusBar />
      <RootNavigator />
    </AppProviders>
  );
};

export default function App(): React.ReactElement {
  return (
    <AppErrorBoundary>
      <AppContent />
    </AppErrorBoundary>
  );
}
