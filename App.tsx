import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { useFonts } from '@expo-google-fonts/bricolage-grotesque';

import AppErrorBoundary from './components/AppErrorBoundary';
import AppLoading from './components/AppLoading';
import AppProviders from './components/AppProviders';
import { appFonts } from './appFonts';
import RootNavigator from './navigation/RootNavigator';
import ThemedStatusBar from './components/ThemedStatusBar';
import { restoreAndReconcileTagWrites } from './utils/tagWriterRecovery';

export const AppContent = (): React.ReactElement => {
  const [fontsLoaded] = useFonts(appFonts);

  useEffect(() => {
    void restoreAndReconcileTagWrites().catch(error => {
      console.warn('[TagWriter] Startup recovery reconciliation failed.', String(error));
    });
  }, []);

  if (!fontsLoaded) return <AppLoading />;

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
