import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppThemeProvider } from '../contexts/AppThemeContext';
import { MusicProvider } from '../contexts/MusicContext';
import { PlaybackProgressProvider } from '../contexts/PlaybackProgressContext';

interface AppProvidersProps {
  children: React.ReactNode;
}

const AppProviders: React.FC<AppProvidersProps> = ({ children }) => (
  <SafeAreaProvider>
    <AppThemeProvider>
      <MusicProvider>
        <PlaybackProgressProvider>{children}</PlaybackProgressProvider>
      </MusicProvider>
    </AppThemeProvider>
  </SafeAreaProvider>
);

export default AppProviders;
