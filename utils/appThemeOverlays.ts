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
  carouselScrimColor: string;
  carouselTitleColor: string;
  carouselArtistColor: string;
  carouselTextShadowColor: string;
}

export const SOUNDCLOUD_PLAYER_COLORS = {
  accent: '#ff5500',
  playerBackground: '#050505',
  artworkBackground: '#111111',
  artworkFallback: '#181818',
  artworkShade: 'rgba(0,0,0,0.16)',
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
  chromeButtonSurface: 'rgba(0,0,0,0.38)',
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

const nowPlayingSoundCloudOverlayColors: Record<AppAppearance, NowPlayingSoundCloudOverlayColors> = {
  dark: {
    gradient: ['rgba(0,0,0,0.72)', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.78)'],
    titleBackgroundColor: 'rgba(0,0,0,0.78)',
    artistBackgroundColor: 'rgba(0,0,0,0.68)',
    infoBackgroundColor: 'rgba(0,0,0,0.68)',
    playButtonBackgroundColor: 'rgba(0,0,0,0.46)',
    carouselScrimColor: 'rgba(0,0,0,0.16)',
    carouselTitleColor: '#ffffff',
    carouselArtistColor: 'rgba(255,255,255,0.78)',
    carouselTextShadowColor: 'rgba(0,0,0,0.45)',
  },
  light: {
    gradient: ['rgba(255,255,255,0.72)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.78)'],
    titleBackgroundColor: 'rgba(255,255,255,0.78)',
    artistBackgroundColor: 'rgba(255,255,255,0.68)',
    infoBackgroundColor: 'rgba(255,255,255,0.68)',
    playButtonBackgroundColor: 'rgba(255,255,255,0.46)',
    carouselScrimColor: 'rgba(255,255,255,0.12)',
    carouselTitleColor: '#101318',
    carouselArtistColor: 'rgba(16,19,25,0.78)',
    carouselTextShadowColor: 'rgba(255,255,255,0.45)',
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
