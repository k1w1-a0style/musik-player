import type { ColorValue } from 'react-native';
import type { AppAppearance } from './appTheme';

export type AppThemeOverlayGradient = readonly [ColorValue, ColorValue, ColorValue];

interface AppThemeBoxOverlayColors {
  backgroundColor: string;
  borderColor: string;
}

export const SOUNDCLOUD_PLAYER_COLORS = {
  accent: '#ff5500',
  playerBackground: '#050505',
  artworkBackground: '#111111',
  artworkFallback: '#181818',
  artworkShade: 'rgba(0,0,0,0.16)',
  artworkFrameBorder: 'rgba(255,255,255,0.18)',
  artworkShadow: '#000000',
  foreground: '#ffffff',
  actionLabel: 'rgba(255,255,255,0.78)',
  waveformRest: 'rgba(255,255,255,0.52)',
  waveformTime: 'rgba(255,255,255,0.82)',
  pageGradient: ['rgba(0,0,0,0.66)', 'rgba(0,0,0,0.04)', 'rgba(0,0,0,0.82)'],
  titleSurface: 'rgba(0,0,0,0.68)',
  artistSurface: 'rgba(0,0,0,0.58)',
  artistText: 'rgba(255,255,255,0.86)',
  pauseScrim: 'rgba(0,0,0,0.32)',
  primaryControlSurface: 'rgba(0,0,0,0.58)',
  primaryControlBorder: 'rgba(255,255,255,0.46)',
  secondaryControlSurface: 'rgba(0,0,0,0.48)',
  secondaryControlBorder: 'rgba(255,255,255,0.36)',
  chromeButtonSurface: '#f7f7f7',
  chromeButtonIcon: '#080808',
  actionBarSurface: 'rgba(8,8,8,0.92)',
  actionBarBorder: 'rgba(255,255,255,0.16)',
  queueBackground: '#0b0b0b',
  queueBorder: 'rgba(255,255,255,0.14)',
  queueControlInactive: 'rgba(255,255,255,0.68)',
  queueControlActive: 'rgba(255,85,0,0.13)',
} as const;

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

export const getPlaylistModalBackdropColor = (
  appearance: AppAppearance,
): string => (appearance === 'light' ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.52)');

export const getLibraryListShellBackgroundColor = (
  appearance: AppAppearance,
): string => (appearance === 'light' ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.055)');

export const getTagEditorWarningBoxColors = (
  appearance: AppAppearance,
): AppThemeBoxOverlayColors => tagEditorWarningBoxColors[appearance];
