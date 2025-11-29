export const theme = {
  palette: {
    primary: '#00FF00',
    secondary: '#00CC00',
    background: '#000000',
    card: '#111111',
    text: {
      primary: '#FFFFFF',
      secondary: '#AAAAAA',
    },
    border: '#222222',
    error: '#FF3333',
    success: '#00FF00',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 16,
  },
};

export type Theme = typeof theme;
