import { DarkTheme, DefaultTheme, type Theme as NavigationTheme } from '@react-navigation/native';
import { getAppTheme, type AppTheme } from '../utils/appTheme';

export const createAppNavigationTheme = (appTheme: AppTheme): NavigationTheme => {
  const baseTheme = appTheme.navigationDark ? DarkTheme : DefaultTheme;

  return {
    ...baseTheme,
    dark: appTheme.navigationDark,
    colors: {
      ...baseTheme.colors,
      primary: appTheme.palette.primary,
      background: appTheme.palette.background,
      card: appTheme.palette.surface,
      text: appTheme.palette.text.primary,
      border: appTheme.palette.border,
      notification: appTheme.palette.accent,
    },
  };
};

export const appNavigationTheme = createAppNavigationTheme(getAppTheme());
