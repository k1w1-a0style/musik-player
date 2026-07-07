import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { getAppTheme } from '../../utils/appTheme';
import { appNavigationTheme, createAppNavigationTheme } from '../appNavigationTheme';

describe('appNavigationTheme', () => {
  test('maps dark app theme palette into navigation colors', () => {
    const theme = getAppTheme('dark', 'neon-cover');
    const navigationTheme = createAppNavigationTheme(theme);

    expect(navigationTheme.dark).toBe(true);
    expect(navigationTheme.colors.primary).toBe(theme.palette.primary);
    expect(navigationTheme.colors.background).toBe(theme.palette.background);
    expect(navigationTheme.colors.card).toBe(theme.palette.surface);
    expect(navigationTheme.colors.text).toBe(theme.palette.text.primary);
    expect(navigationTheme.colors.border).toBe(theme.palette.border);
    expect(navigationTheme.colors.notification).toBe(theme.palette.accent);
    expect(navigationTheme.fonts).toBe(DarkTheme.fonts);
  });

  test('maps light app theme palette into navigation colors', () => {
    const theme = getAppTheme('light', 'minimal');
    const navigationTheme = createAppNavigationTheme(theme);

    expect(navigationTheme.dark).toBe(false);
    expect(navigationTheme.colors.primary).toBe(theme.palette.primary);
    expect(navigationTheme.colors.background).toBe(theme.palette.background);
    expect(navigationTheme.colors.card).toBe(theme.palette.surface);
    expect(navigationTheme.colors.text).toBe(theme.palette.text.primary);
    expect(navigationTheme.colors.border).toBe(theme.palette.border);
    expect(navigationTheme.colors.notification).toBe(theme.palette.accent);
    expect(navigationTheme.fonts).toBe(DefaultTheme.fonts);
  });

  test('exports a default navigation theme from the default app theme', () => {
    const defaultTheme = getAppTheme();

    expect(appNavigationTheme.dark).toBe(defaultTheme.navigationDark);
    expect(appNavigationTheme.colors.primary).toBe(defaultTheme.palette.primary);
    expect(appNavigationTheme.colors.background).toBe(defaultTheme.palette.background);
    expect(appNavigationTheme.colors.text).toBe(defaultTheme.palette.text.primary);
  });
});
