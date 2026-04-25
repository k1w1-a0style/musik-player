/**
 * Design System — "Midnight Ember"
 *
 * Visual language: deep indigo-black canvas with warm amber accents,
 * glass-morphism surfaces, Bricolage Grotesque typography.
 */

export const theme = {
  palette: {
    // Canvas
    background: '#05060A',
    backgroundDeep: '#0A0D18',
    surface: '#10131F',
    surfaceElevated: '#181C2B',
    surfaceGlass: 'rgba(24, 28, 43, 0.6)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(255, 255, 255, 0.14)',

    // Brand — warm amber
    primary: '#F5B301',
    primaryDark: '#D99500',
    primaryGlow: 'rgba(245, 179, 1, 0.18)',

    // Secondary — electric indigo
    accent: '#7C5CFF',
    accentGlow: 'rgba(124, 92, 255, 0.22)',

    // Semantic
    success: '#3DDC97',
    error: '#FF5C7C',
    warning: '#FFB347',

    // Text
    text: {
      primary: '#F6F5F1',
      secondary: 'rgba(246, 245, 241, 0.64)',
      muted: 'rgba(246, 245, 241, 0.38)',
      onPrimary: '#0A0A10',
    },
  },

  gradients: {
    background: ['#05060A', '#0A0D18', '#0F0A1E'] as const,
    accent: ['#F5B301', '#FF8A00', '#FF3D7F'] as const,
    glass: ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.01)'] as const,
    nowPlaying: ['#1A1530', '#2A1B4A', '#12081E'] as const,
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  borderRadius: {
    sm: 8,
    md: 14,
    lg: 22,
    xl: 32,
    pill: 999,
  },

  fonts: {
    display: 'Bricolage-Bold',
    heading: 'Bricolage-SemiBold',
    body: 'Bricolage-Regular',
    mono: 'Menlo',
  },

  typography: {
    hero: { fontSize: 40, lineHeight: 44, letterSpacing: -1.2 },
    h1: { fontSize: 28, lineHeight: 32, letterSpacing: -0.6 },
    h2: { fontSize: 22, lineHeight: 26, letterSpacing: -0.4 },
    body: { fontSize: 15, lineHeight: 22 },
    small: { fontSize: 12, lineHeight: 16, letterSpacing: 0.3 },
    caps: { fontSize: 11, lineHeight: 14, letterSpacing: 1.6 },
  },

  shadows: {
    glow: {
      shadowColor: '#F5B301',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 24,
      elevation: 12,
    },
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 12,
      elevation: 6,
    },
  },
} as const;

export type Theme = typeof theme;
