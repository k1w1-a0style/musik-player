export const theme = {
  palette: {
    primary: '#22C55E',
    primaryDark: '#16A34A',
    accent: '#10B981',
    background: '#0A0A0A',
    card: '#141414',
    cardElevated: '#1C1C1C',
    text: {
      primary: '#F5F5F5',
      secondary: '#A3A3A3',
      onPrimary: '#0A0A0A',
    },
    border: '#262626',
    error: '#EF4444',
    success: '#22C55E',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 6,
    md: 12,
    lg: 20,
    pill: 999,
  },
} as const;

export type Theme = typeof theme;
