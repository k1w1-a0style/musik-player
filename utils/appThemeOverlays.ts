import type { ColorValue } from 'react-native';
import type { AppAppearance } from './appTheme';

export type AppThemeOverlayGradient = readonly [ColorValue, ColorValue, ColorValue];

interface AppThemeBoxOverlayColors {
  backgroundColor: string;
  borderColor: string;
}

interface NowPlayingSoundCloudOverlayColors {
  gradient: AppThemeOverlayGradient;
  titleBackgroundColor: string;
  artistBackgroundColor: string;
  infoBackgroundColor: string;
  playButtonBackgroundColor: string;
}

const nowPlayingBackdropOverlayColors: Record<AppAppearance, AppThemeOverlayGradient> = {
  dark: [
    'rgba(5,6,10,0.0)',
    'rgba(5,6,10,0.55)',
    'rgba(5,6,10,0.95)',
  ],
  light: [
    'rgba(244,245,247,0.0)',
    'rgba(244,245,247,0.44)',
    'rgba(244,245,247,0.86)',
  ],
};

const nowPlayingSoundCloudOverlayColors: Record<AppAppearance, NowPlayingSoundCloudOverlayColors> = {
  dark: {
    gradient: ['rgba(0,0,0,0.72)', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.78)'],
    titleBackgroundColor: 'rgba(0,0,0,0.78)',
    artistBackgroundColor: 'rgba(0,0,0,0.68)',
    infoBackgroundColor: 'rgba(0,0,0,0.68)',
    playButtonBackgroundColor: 'rgba(0,0,0,0.46)',
  },
  light: {
    gradient: ['rgba(255,255,255,0.72)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.78)'],
    titleBackgroundColor: 'rgba(255,255,255,0.78)',
    artistBackgroundColor: 'rgba(255,255,255,0.68)',
    infoBackgroundColor: 'rgba(255,255,255,0.68)',
    playButtonBackgroundColor: 'rgba(255,255,255,0.46)',
  },
};

const tagEditorWarningBoxColors: Record<AppAppearance, AppThemeBoxOverlayColors> = {
  dark: {
    backgroundColor: 'rgba(255, 111, 138, 0.12)',
    borderColor: 'rgba(255, 111, 138, 0.40)',
  },
  light: {
    backgroundColor: 'rgba(200, 58, 89, 0.10)',
    borderColor: 'rgba(200, 58, 89, 0.34)',
  },
};

export const getNowPlayingBackdropOverlayColors = (
  appearance: AppAppearance,
): AppThemeOverlayGradient => nowPlayingBackdropOverlayColors[appearance];

export const getNowPlayingSoundCloudOverlayColors = (
  appearance: AppAppearance,
): NowPlayingSoundCloudOverlayColors => nowPlayingSoundCloudOverlayColors[appearance];

export const getNowPlayingSnapPagerInactiveDotColor = (
  appearance: AppAppearance,
): string => (appearance === 'light' ? 'rgba(16,19,25,0.24)' : 'rgba(255,255,255,0.25)');

export const getNowPlayingWaveformRestColor = (
  appearance: AppAppearance,
): string => (appearance === 'light' ? 'rgba(16,19,25,0.18)' : 'rgba(255,255,255,0.22)');

export const getNowPlayingMenuBackdropColor = (
  appearance: AppAppearance,
): string => (appearance === 'light' ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.22)');

export const getLibraryMenuBackdropColor = (
  appearance: AppAppearance,
): string => (appearance === 'light' ? 'rgba(0,0,0,0.14)' : 'rgba(0,0,0,0.22)');

export const getLibraryListShellBackgroundColor = (
  appearance: AppAppearance,
): string => (appearance === 'light' ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.055)');

export const getTagEditorWarningBoxColors = (
  appearance: AppAppearance,
): AppThemeBoxOverlayColors => tagEditorWarningBoxColors[appearance];
