import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppThemeProvider } from '../contexts/AppThemeContext';
import { MusicProvider } from '../contexts/MusicContext';
import { PlaybackProgressProvider } from '../contexts/PlaybackProgressContext';
import { PlayerPresentationProvider } from '../contexts/PlayerPresentationContext';
import { LibraryUpdateProvider } from '../contexts/LibraryUpdateContext';
import { PlaybackResumeProvider } from '../contexts/PlaybackResumeContext';
import { AccentPreferencesProvider } from '../contexts/AccentPreferencesContext';
import { PaletteRuntimeBridge } from '../contexts/PaletteRuntimeBridge';

interface AppProvidersProps {
  children: React.ReactNode;
}

const AppProviders: React.FC<AppProvidersProps> = ({ children }) => (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <AccentPreferencesProvider>
      <AppThemeProvider>
        <PlayerPresentationProvider><LibraryUpdateProvider>
          <PlaybackResumeProvider><MusicProvider>
            <PaletteRuntimeBridge />
            <PlaybackProgressProvider>{children}</PlaybackProgressProvider>
          </MusicProvider></PlaybackResumeProvider>
        </LibraryUpdateProvider></PlayerPresentationProvider>
      </AppThemeProvider>
      </AccentPreferencesProvider>
    </SafeAreaProvider>
  </GestureHandlerRootView>
);

export default AppProviders;
