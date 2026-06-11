import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MusicProvider } from '../contexts/MusicContext';
import { PlaybackProgressProvider } from '../contexts/PlaybackProgressContext';

interface AppProvidersProps {
  children: React.ReactNode;
}

const AppProviders: React.FC<AppProvidersProps> = ({ children }) => (
  <SafeAreaProvider>
    <MusicProvider>
      <PlaybackProgressProvider>{children}</PlaybackProgressProvider>
    </MusicProvider>
  </SafeAreaProvider>
);

export default AppProviders;
