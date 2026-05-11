export const theme = {
  palette: {
    background: '#040404',
    backgroundDeep: '#000000',
    surface: '#101112',
    surfaceElevated: '#17191B',
    surfaceGlass: 'rgba(16, 17, 18, 0.72)',
    card: '#101112',
    cardElevated: '#1A1D20',
    border: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(110, 255, 130, 0.45)',
    primary: '#6EFF82',
    primaryDark: '#33C85D',
    primaryGlow: 'rgba(110, 255, 130, 0.22)',
    accent: '#5FE070',
    accentGlow: 'rgba(95, 224, 112, 0.16)',
    success: '#63F08A',
    error: '#FF6F8A',
    warning: '#FFCA77',
    text: {
      primary: '#F5F8F6',
      secondary: 'rgba(245, 248, 246, 0.72)',
      muted: 'rgba(245, 248, 246, 0.42)',
      onPrimary: '#071109',
    },
  },
  gradients: {
    background: ['#000000', '#050706', '#0A0D0B'] as const,
    accent: ['#2A5A35', '#4FA95F', '#6EFF82'] as const,
    glass: ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.01)'] as const,
    nowPlaying: ['#000000', '#070A08', '#0B0F0D'] as const,
    nowPlayingBackdrop: (_accent: string, accentDark: string) =>
      [accentDark, theme.palette.backgroundDeep, theme.palette.background] as const,
  },
  blur: { light: 20, medium: 40, heavy: 60 },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  borderRadius: { sm: 10, md: 16, lg: 24, xl: 34, pill: 999 },
  radii: { input: 12, card: 18, elevatedCard: 24, control: 22 },
  fonts: { display: 'Bricolage-Bold', heading: 'Bricolage-SemiBold', body: 'Bricolage-Regular', mono: 'Menlo' },
  typography: {
    hero: { fontSize: 40, lineHeight: 44, letterSpacing: -1.2 }, h1: { fontSize: 28, lineHeight: 32, letterSpacing: -0.6 },
    h2: { fontSize: 22, lineHeight: 26, letterSpacing: -0.4 }, body: { fontSize: 15, lineHeight: 22 }, small: { fontSize: 12, lineHeight: 16, letterSpacing: 0.3 }, caps: { fontSize: 11, lineHeight: 14, letterSpacing: 1.6 },
  },
  shadows: {
    glow: { shadowColor: '#6EFF82', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 22, elevation: 12 },
    card: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 14, elevation: 6 },
  },
} as const;

export type Theme = typeof theme;
