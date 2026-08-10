import { Platform, type StatusBarStyle } from 'react-native';

const monoFontFamily = Platform.OS === 'android' ? 'monospace' : 'Menlo';

export type AppAppearance = 'dark' | 'light';
export type AppThemeSkin = 'graphite' | 'minimal' | 'neon-cover';

export const DEFAULT_APP_APPEARANCE: AppAppearance = 'dark';
export const DEFAULT_APP_THEME_SKIN: AppThemeSkin = 'graphite';

export const APP_APPEARANCES: AppAppearance[] = ['dark', 'light'];
export const APP_THEME_SKINS: AppThemeSkin[] = ['graphite', 'minimal', 'neon-cover'];

export const APP_APPEARANCE_LABELS: Record<AppAppearance, string> = {
  dark: 'Dunkel',
  light: 'Hell',
};

export const APP_THEME_SKIN_LABELS: Record<AppThemeSkin, string> = {
  graphite: 'Graphite',
  minimal: 'Minimal',
  'neon-cover': 'Neon Cover',
};

export interface AppThemePalette {
  background: string;
  backgroundDeep: string;
  surface: string;
  surfaceElevated: string;
  surfaceGlass: string;
  card: string;
  cardElevated: string;
  border: string;
  borderStrong: string;
  primary: string;
  primaryDark: string;
  primaryGlow: string;
  accent: string;
  accentGlow: string;
  success: string;
  error: string;
  warning: string;
  text: {
    primary: string;
    secondary: string;
    muted: string;
    onPrimary: string;
  };
}

export interface AppThemeTokens {
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  radii: {
    input: number;
    card: number;
    elevatedCard: number;
    control: number;
  };
  fonts: {
    display: string;
    heading: string;
    body: string;
    mono: string;
  };
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    pill: number;
  };
  typography: {
    hero: { fontSize: number; lineHeight: number; letterSpacing: number };
    h1: { fontSize: number; lineHeight: number; letterSpacing: number };
    h2: { fontSize: number; lineHeight: number; letterSpacing: number };
    body: { fontSize: number; lineHeight: number };
    small: { fontSize: number; lineHeight: number; letterSpacing: number };
    caps: { fontSize: number; lineHeight: number; letterSpacing: number };
  };
}

export const APP_THEME_TOKENS: AppThemeTokens = {
  spacing: { xs: 4, sm: 8, md: 14, lg: 20, xl: 28, xxl: 40 },
  radii: { input: 10, card: 14, elevatedCard: 20, control: 18 },
  fonts: { display: 'Bricolage-Bold', heading: 'Bricolage-SemiBold', body: 'Bricolage-Regular', mono: monoFontFamily },
  borderRadius: { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 },
  typography: {
    hero: { fontSize: 34, lineHeight: 38, letterSpacing: -1.0 },
    h1: { fontSize: 24, lineHeight: 28, letterSpacing: -0.5 },
    h2: { fontSize: 19, lineHeight: 23, letterSpacing: -0.3 },
    body: { fontSize: 14, lineHeight: 20 },
    small: { fontSize: 11, lineHeight: 15, letterSpacing: 0.2 },
    caps: { fontSize: 10, lineHeight: 13, letterSpacing: 1.4 },
  },
};

export interface AppTheme {
  id: string;
  appearance: AppAppearance;
  skin: AppThemeSkin;
  label: string;
  navigationDark: boolean;
  statusBarStyle: StatusBarStyle;
  tokens: AppThemeTokens;
  palette: AppThemePalette;
  gradients: {
    background: readonly [string, string, string];
    nowPlaying: readonly [string, string, string];
  };
}

const graphiteDark: AppTheme = {
  id: 'graphite-dark',
  appearance: 'dark',
  skin: 'graphite',
  label: 'Graphite Dark',
  navigationDark: true,
  statusBarStyle: 'light-content',
  tokens: APP_THEME_TOKENS,
  palette: {
    background: '#08090B',
    backgroundDeep: '#030406',
    surface: '#111318',
    surfaceElevated: '#191B21',
    surfaceGlass: 'rgba(18, 20, 26, 0.76)',
    card: '#111318',
    cardElevated: '#1A1D24',
    border: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(210, 218, 230, 0.28)',
    primary: '#D8DEE8',
    primaryDark: '#87909E',
    primaryGlow: 'rgba(216, 222, 232, 0.12)',
    accent: '#BFC7D4',
    accentGlow: 'rgba(191, 199, 212, 0.10)',
    success: '#D8DEE8',
    error: '#FF6F8A',
    warning: '#FFCA77',
    text: {
      primary: '#F4F5F7',
      secondary: 'rgba(244, 245, 247, 0.70)',
      muted: 'rgba(244, 245, 247, 0.52)',
      onPrimary: '#07090C',
    },
  },
  gradients: {
    background: ['#030406', '#08090B', '#0D1014'],
    nowPlaying: ['#030406', '#08090B', '#0D1014'],
  },
};

const graphiteLight: AppTheme = {
  id: 'graphite-light',
  appearance: 'light',
  skin: 'graphite',
  label: 'Graphite Light',
  navigationDark: false,
  statusBarStyle: 'dark-content',
  tokens: APP_THEME_TOKENS,
  palette: {
    background: '#F4F5F7',
    backgroundDeep: '#E8EAEE',
    surface: '#FFFFFF',
    surfaceElevated: '#EEF1F5',
    surfaceGlass: 'rgba(255, 255, 255, 0.82)',
    card: '#FFFFFF',
    cardElevated: '#F0F2F6',
    border: 'rgba(12, 16, 22, 0.10)',
    borderStrong: 'rgba(12, 16, 22, 0.20)',
    primary: '#232832',
    primaryDark: '#515B6A',
    primaryGlow: 'rgba(35, 40, 50, 0.10)',
    accent: '#4F5B6B',
    accentGlow: 'rgba(79, 91, 107, 0.12)',
    success: '#2E7D50',
    error: '#C83A59',
    warning: '#A76519',
    text: {
      primary: '#101319',
      secondary: 'rgba(16, 19, 25, 0.68)',
      muted: 'rgba(16, 19, 25, 0.60)',
      onPrimary: '#FFFFFF',
    },
  },
  gradients: {
    background: ['#E8EAEE', '#F4F5F7', '#FFFFFF'],
    nowPlaying: ['#E8EAEE', '#F4F5F7', '#FFFFFF'],
  },
};

const minimalDark: AppTheme = {
  ...graphiteDark,
  id: 'minimal-dark',
  skin: 'minimal',
  label: 'Minimal Dark',
  palette: {
    ...graphiteDark.palette,
    background: '#050607',
    surface: '#0D0F12',
    surfaceElevated: '#14171C',
    primary: '#F1F2F4',
    accent: '#9BA3AF',
    borderStrong: 'rgba(255, 255, 255, 0.18)',
  },
};

const minimalLight: AppTheme = {
  ...graphiteLight,
  id: 'minimal-light',
  skin: 'minimal',
  label: 'Minimal Light',
  palette: {
    ...graphiteLight.palette,
    background: '#FAFAFB',
    surface: '#FFFFFF',
    surfaceElevated: '#F1F2F4',
    primary: '#111317',
    accent: '#5A6370',
  },
};

const neonCoverDark: AppTheme = {
  ...graphiteDark,
  id: 'neon-cover-dark',
  skin: 'neon-cover',
  label: 'Neon Cover Dark',
  palette: {
    ...graphiteDark.palette,
    primary: '#55D8FF',
    primaryDark: '#167EA0',
    primaryGlow: 'rgba(85, 216, 255, 0.18)',
    accent: '#D765FF',
    accentGlow: 'rgba(215, 101, 255, 0.14)',
    borderStrong: 'rgba(85, 216, 255, 0.34)',
  },
  gradients: {
    background: ['#030406', '#070812', '#100719'],
    nowPlaying: ['#030406', '#080A16', '#16091F'],
  },
};

const neonCoverLight: AppTheme = {
  ...graphiteLight,
  id: 'neon-cover-light',
  skin: 'neon-cover',
  label: 'Neon Cover Light',
  palette: {
    ...graphiteLight.palette,
    primary: '#1B79A5',
    primaryDark: '#155B7A',
    primaryGlow: 'rgba(27, 121, 165, 0.13)',
    accent: '#8B36B5',
    accentGlow: 'rgba(139, 54, 181, 0.12)',
    borderStrong: 'rgba(27, 121, 165, 0.24)',
  },
};

const THEMES: Record<AppAppearance, Record<AppThemeSkin, AppTheme>> = {
  dark: {
    graphite: graphiteDark,
    minimal: minimalDark,
    'neon-cover': neonCoverDark,
  },
  light: {
    graphite: graphiteLight,
    minimal: minimalLight,
    'neon-cover': neonCoverLight,
  },
};

export const isAppAppearance = (value: unknown): value is AppAppearance =>
  value === 'dark' || value === 'light';

export const isAppThemeSkin = (value: unknown): value is AppThemeSkin =>
  value === 'graphite' || value === 'minimal' || value === 'neon-cover';

export const normalizeAppAppearance = (value: unknown): AppAppearance =>
  isAppAppearance(value) ? value : DEFAULT_APP_APPEARANCE;

export const normalizeAppThemeSkin = (value: unknown): AppThemeSkin =>
  isAppThemeSkin(value) ? value : DEFAULT_APP_THEME_SKIN;

export const getAppTheme = (
  appearance: AppAppearance = DEFAULT_APP_APPEARANCE,
  skin: AppThemeSkin = DEFAULT_APP_THEME_SKIN,
): AppTheme => THEMES[normalizeAppAppearance(appearance)][normalizeAppThemeSkin(skin)];
