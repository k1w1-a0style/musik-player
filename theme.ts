export const theme = {
  palette: {
    background: '#080808',
    backgroundDeep: '#030303',
    surface: '#111214',
    surfaceElevated: '#18191B',
    surfaceGlass: 'rgba(18, 19, 21, 0.76)',
    card: '#111214',
    cardElevated: '#191A1D',
    border: 'rgba(255, 255, 255, 0.075)',
    borderStrong: 'rgba(110, 255, 130, 0.36)',
    primary: '#6EFF82',
    primaryDark: '#33C85D',
    primaryGlow: 'rgba(110, 255, 130, 0.16)',
    accent: '#5FE070',
    accentGlow: 'rgba(95, 224, 112, 0.12)',
    success: '#63F08A',
    error: '#FF6F8A',
    warning: '#FFCA77',
    text: {
      primary: '#F4F5F3',
      secondary: 'rgba(244, 245, 243, 0.70)',
      muted: 'rgba(244, 245, 243, 0.42)',
      onPrimary: '#071109',
    },
  },
  gradients: {
    background: ['#030303', '#080808', '#0D0E0E'] as const,
    accent: ['#2A5A35', '#4FA95F', '#6EFF82'] as const,
    glass: ['rgba(255,255,255,0.045)', 'rgba(255,255,255,0.008)'] as const,
    nowPlaying: ['#030303', '#080808', '#0E0F0F'] as const,
    nowPlayingBackdrop: (_accent: string, accentDark: string) =>
      [accentDark, theme.palette.backgroundDeep, theme.palette.background] as const,
  },
  blur: { light: 16, medium: 32, heavy: 52 },
  spacing: { xs: 4, sm: 8, md: 14, lg: 20, xl: 28, xxl: 40 },
  borderRadius: { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 },
  radii: { input: 10, card: 14, elevatedCard: 20, control: 18 },
  fonts: { display: 'Bricolage-Bold', heading: 'Bricolage-SemiBold', body: 'Bricolage-Regular', mono: 'Menlo' },
  typography: {
    hero: { fontSize: 34, lineHeight: 38, letterSpacing: -1.0 },
    h1: { fontSize: 24, lineHeight: 28, letterSpacing: -0.5 },
    h2: { fontSize: 19, lineHeight: 23, letterSpacing: -0.3 },
    body: { fontSize: 14, lineHeight: 20 },
    small: { fontSize: 11, lineHeight: 15, letterSpacing: 0.2 },
    caps: { fontSize: 10, lineHeight: 13, letterSpacing: 1.4 },
  },
  shadows: {
    glow: { shadowColor: '#6EFF82', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 18, elevation: 9 },
    card: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.38, shadowRadius: 11, elevation: 4 },
  },
} as const;

export type Theme = typeof theme;
