import { processColor, type ColorValue } from 'react-native';
import type { AppAppearance } from './appTheme';

export type AppThemeOverlayGradient = readonly [ColorValue, ColorValue, ColorValue];

/** Composite retargeted backdrop palettes without retaining old image layers. */
export const blendBackdropColor = (left: ColorValue, right: ColorValue, fraction: number): ColorValue => {
  const leftColor = processColor(left);
  const rightColor = processColor(right);
  if (typeof leftColor !== 'number' || typeof rightColor !== 'number') return fraction < 0.5 ? left : right;
  const channel = (shift: number): number => Math.round(
    ((leftColor >>> shift) & 255) * (1 - fraction) + ((rightColor >>> shift) & 255) * fraction);
  return `rgba(${channel(16)},${channel(8)},${channel(0)},${channel(24) / 255})`;
};

interface AppThemeBoxOverlayColors {
  backgroundColor: string;
  borderColor: string;
}

export const SOUNDCLOUD_PLAYER_COLORS = {
  accent: '#ff5500',
  playerBackground: '#050505',
  artworkBackground: '#111111',
  artworkFallback: '#181818',
  artworkShade: 'transparent',
  artworkFrameBorder: 'rgba(255,255,255,0.18)',
  artworkShadow: '#000000',
  foreground: '#ffffff',
  actionLabel: 'rgba(255,255,255,0.78)',
  waveformRest: '#ededed',
  waveformOutline: 'rgba(0,0,0,0.85)',
  waveformPlayhead: '#ffffff',
  waveformPlayheadOutline: 'rgba(0,0,0,0.78)',
  waveformTime: 'rgba(255,255,255,0.82)',
  pageGradient: ['rgba(0,0,0,0.22)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.38)'],
  titleSurface: 'rgba(0,0,0,0.68)',
  artistSurface: 'rgba(0,0,0,0.58)',
  artistText: 'rgba(255,255,255,0.86)',
  pauseScrim: 'transparent',
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
