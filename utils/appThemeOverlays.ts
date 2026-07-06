import type { ColorValue } from 'react-native';
import type { AppAppearance } from './appTheme';

export type AppThemeOverlayGradient = readonly [ColorValue, ColorValue, ColorValue];

interface AppThemeBoxOverlayColors {
  backgroundColor: string;
  borderColor: string;
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
