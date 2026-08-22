import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
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
import { startStartupTimer } from './utils/startupTiming';

export const AppContent = (): React.ReactElement => {
  const [fontsLoaded, fontError] = useFonts(appFonts);
  const finishFontTimingRef = useRef<ReturnType<typeof startStartupTimer> | null>(null);
  if (!finishFontTimingRef.current) finishFontTimingRef.current = startStartupTimer('fonts');

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

  useEffect(() => {
    if (fontsLoaded) finishFontTimingRef.current?.('ready');
    else if (fontError) finishFontTimingRef.current?.('fallback');
    if (fontError) console.warn('[Fonts] Custom fonts failed to load; using the system fallback.', String(fontError));
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) return <AppLoading />;

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
