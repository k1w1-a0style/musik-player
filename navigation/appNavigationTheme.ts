import { DefaultTheme } from '@react-navigation/native';
import { theme } from '../theme';

export const appNavigationTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: theme.palette.primary,
    background: theme.palette.background,
    card: theme.palette.surface,
    text: theme.palette.text.primary,
    border: theme.palette.border,
    notification: theme.palette.accent,
  },
};
