import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppThemeProvider } from '../contexts/AppThemeContext';
import { MusicProvider } from '../contexts/MusicContext';
import { PlaybackProgressProvider } from '../contexts/PlaybackProgressContext';
import { PlayerPresentationProvider } from '../contexts/PlayerPresentationContext';

interface AppProvidersProps {
  children: React.ReactNode;
}

const AppProviders: React.FC<AppProvidersProps> = ({ children }) => (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <AppThemeProvider>
        <PlayerPresentationProvider>
          <MusicProvider>
            <PlaybackProgressProvider>{children}</PlaybackProgressProvider>
          </MusicProvider>
        </PlayerPresentationProvider>
      </AppThemeProvider>
    </SafeAreaProvider>
  </GestureHandlerRootView>
);

export default AppProviders;
