import 'react-native-gesture-handler';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFonts } from 'expo-font';

import AppErrorBoundary from './components/AppErrorBoundary';
import AppLoading from './components/AppLoading';
import AppProviders from './components/AppProviders';
import { appFonts } from './appFonts';
import RootNavigator from './navigation/RootNavigator';
import ThemedStatusBar from './components/ThemedStatusBar';
import {
  isTagWriteStartupTimeoutError,
  restoreAndReconcileTagWrites,
} from './utils/tagWriterRecovery';

export const AppContent = (): React.ReactElement => {
  const [fontsLoaded, fontError] = useFonts(appFonts);
  const [tagWritesReady, setTagWritesReady] = useState(false);
  const [tagWritesFailed, setTagWritesFailed] = useState(false);
  const mountedRef = useRef(true);
  const recoveryRef = useRef<Promise<void> | null>(null);

  const restoreTagWrites = useCallback(() => {
    if (recoveryRef.current) return recoveryRef.current;
    if (mountedRef.current) setTagWritesFailed(false);
    const recovery = restoreAndReconcileTagWrites().then(() => {
      if (mountedRef.current) setTagWritesReady(true);
    }, error => {
      if (isTagWriteStartupTimeoutError(error)) {
        console.warn('[TagWriter] Startup recovery timed out; continuing with tag writes disabled.', String(error));
        if (mountedRef.current) setTagWritesReady(true);
        return;
      }
      console.warn('[TagWriter] Startup recovery reconciliation failed.', String(error));
      if (mountedRef.current) setTagWritesFailed(true);
    }).finally(() => {
      if (recoveryRef.current === recovery) recoveryRef.current = null;
    });
    recoveryRef.current = recovery;
    return recovery;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void restoreTagWrites();
    return () => { mountedRef.current = false; };
  }, [restoreTagWrites]);

  useEffect(() => {
    if (fontError) console.warn('[Fonts] Custom fonts failed to load; using the system fallback.', String(fontError));
  }, [fontError]);

  if ((!fontsLoaded && !fontError) || !tagWritesReady)
    return <AppLoading degraded={tagWritesFailed} onRetry={restoreTagWrites} />;

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
