import {
  APP_APPEARANCE_LABELS,
  APP_THEME_SKIN_LABELS,
  getAppTheme,
  isAppAppearance,
  isAppThemeSkin,
  normalizeAppAppearance,
  normalizeAppThemeSkin,
} from '../appTheme';

describe('appTheme', () => {
  test('normalizes unknown appearance and skin values to safe defaults', () => {
    expect(normalizeAppAppearance('light')).toBe('light');
    expect(normalizeAppAppearance('kaputt')).toBe('dark');
    expect(normalizeAppThemeSkin('minimal')).toBe('minimal');
    expect(normalizeAppThemeSkin('radioactive-green')).toBe('graphite');
  });

  test('guards appearance and skin values', () => {
    expect(isAppAppearance('dark')).toBe(true);
    expect(isAppAppearance('system')).toBe(false);
    expect(isAppThemeSkin('neon-cover')).toBe(true);
    expect(isAppThemeSkin('green')).toBe(false);
  });

  test('returns the requested app theme', () => {
    expect(getAppTheme('dark', 'graphite').label).toBe('Graphite Dark');
    expect(getAppTheme('light', 'graphite').statusBarStyle).toBe('dark-content');
    expect(getAppTheme('dark', 'neon-cover').palette.primary).toBe('#55D8FF');
  });

  test('exposes German labels', () => {
    expect(APP_APPEARANCE_LABELS.dark).toBe('Dunkel');
    expect(APP_THEME_SKIN_LABELS['neon-cover']).toBe('Neon Cover');
  });
});
