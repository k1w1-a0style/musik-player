import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppErrorBoundary from '../AppErrorBoundary';
import AppProviders from '../AppProviders';
import { AppThemeProvider } from '../../contexts/AppThemeContext';
import { MusicProvider } from '../../contexts/MusicContext';
import { PlaybackProgressProvider } from '../../contexts/PlaybackProgressContext';
import { PlayerPresentationProvider } from '../../contexts/PlayerPresentationContext';
import { LibraryUpdateProvider } from '../../contexts/LibraryUpdateContext';
import { PlaybackResumeProvider } from '../../contexts/PlaybackResumeContext';
import { AccentPreferencesProvider } from '../../contexts/AccentPreferencesContext';
import { PaletteRuntimeBridge } from '../../contexts/PaletteRuntimeBridge';

const onlyChild = (element: React.ReactElement<{ children?: React.ReactNode }>) =>
  React.Children.only(element.props.children) as React.ReactElement<{ children?: React.ReactNode }>;

describe('AppProviders', () => {
  test('keeps provider order without a second root error boundary', () => {
    const tree = AppProviders({ children: <></> }) as React.ReactElement<{ children?: React.ReactNode }>;
    const safeArea = onlyChild(tree);
    const accentPreferencesProvider = onlyChild(safeArea);
    const appThemeProvider = onlyChild(accentPreferencesProvider);
    const presentationProvider = onlyChild(appThemeProvider);
    const updateProvider = onlyChild(presentationProvider);
    const resumeProvider = onlyChild(updateProvider);
    const musicProvider = onlyChild(resumeProvider);
    const musicChildren = React.Children.toArray(musicProvider.props.children) as React.ReactElement[];
    const playbackProvider = musicChildren[1];

    expect(tree.type).not.toBe(AppErrorBoundary);
    expect(tree.type).toBe(GestureHandlerRootView);
    expect(safeArea.type).toBe(SafeAreaProvider);
    expect(accentPreferencesProvider.type).toBe(AccentPreferencesProvider);
    expect(appThemeProvider.type).toBe(AppThemeProvider);
    expect(presentationProvider.type).toBe(PlayerPresentationProvider);
    expect(updateProvider.type).toBe(LibraryUpdateProvider);
    expect(resumeProvider.type).toBe(PlaybackResumeProvider);
    expect(musicProvider.type).toBe(MusicProvider);
    expect(musicChildren[0].type).toBe(PaletteRuntimeBridge);
    expect(playbackProvider.type).toBe(PlaybackProgressProvider);
  });
});
