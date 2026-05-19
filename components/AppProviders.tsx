import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppErrorBoundary from './AppErrorBoundary';
import { MusicProvider } from '../contexts/MusicContext';
import { PlaybackProgressProvider } from '../contexts/PlaybackProgressContext';

interface AppProvidersProps {
  children: React.ReactNode;
}

const AppProviders: React.FC<AppProvidersProps> = ({ children }) => (
  <SafeAreaProvider>
    <AppErrorBoundary>
      <MusicProvider>
        <PlaybackProgressProvider>{children}</PlaybackProgressProvider>
      </MusicProvider>
    </AppErrorBoundary>
  </SafeAreaProvider>
);

export default AppProviders;
