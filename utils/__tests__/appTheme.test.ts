import {
  APP_APPEARANCE_LABELS,
  APP_APPEARANCES,
  APP_THEME_SKIN_LABELS,
  APP_THEME_SKINS,
  DEFAULT_APP_APPEARANCE,
  DEFAULT_APP_THEME_SKIN,
  getAppTheme,
  isAppAppearance,
  isAppThemeSkin,
  normalizeAppAppearance,
  normalizeAppThemeSkin,
} from '../appTheme';

describe('appTheme', () => {
  test('normalizes unknown appearance and skin values to safe defaults', () => {
    expect(DEFAULT_APP_APPEARANCE).toBe('dark');
    expect(DEFAULT_APP_THEME_SKIN).toBe('graphite');
    expect(normalizeAppAppearance('light')).toBe('light');
    expect(normalizeAppAppearance('kaputt')).toBe(DEFAULT_APP_APPEARANCE);
    expect(normalizeAppAppearance(undefined)).toBe(DEFAULT_APP_APPEARANCE);
    expect(normalizeAppThemeSkin('minimal')).toBe('minimal');
    expect(normalizeAppThemeSkin('radioactive-green')).toBe(DEFAULT_APP_THEME_SKIN);
    expect(normalizeAppThemeSkin(null)).toBe(DEFAULT_APP_THEME_SKIN);
  });

  test('guards appearance and skin values', () => {
    expect(APP_APPEARANCES.every(isAppAppearance)).toBe(true);
    expect(APP_THEME_SKINS.every(isAppThemeSkin)).toBe(true);
    expect(isAppAppearance('dark')).toBe(true);
    expect(isAppAppearance('system')).toBe(false);
    expect(isAppThemeSkin('neon-cover')).toBe(true);
    expect(isAppThemeSkin('green')).toBe(false);
  });

  test('exposes German labels for every selectable option', () => {
    expect(APP_APPEARANCES.map(option => APP_APPEARANCE_LABELS[option])).toEqual(['Dunkel', 'Hell']);
    expect(APP_THEME_SKINS.map(option => APP_THEME_SKIN_LABELS[option])).toEqual(['Graphite', 'Minimal', 'Neon Cover']);
  });

  test('returns complete themes for every appearance and skin combination', () => {
    for (const appearance of APP_APPEARANCES) {
      for (const skin of APP_THEME_SKINS) {
        const theme = getAppTheme(appearance, skin);

        expect(theme.id).toBe(`${skin}-${appearance}`);
        expect(theme.appearance).toBe(appearance);
        expect(theme.skin).toBe(skin);
        expect(theme.label).toContain(APP_THEME_SKIN_LABELS[skin]);
        expect(theme.label).toContain(appearance === 'dark' ? 'Dark' : 'Light');
        expect(theme.navigationDark).toBe(appearance === 'dark');
        expect(theme.statusBarStyle).toBe(appearance === 'dark' ? 'light-content' : 'dark-content');
        expect(theme.gradients.background).toHaveLength(3);
        expect(theme.gradients.nowPlaying).toHaveLength(3);
        expect(theme.palette.background).toBeTruthy();
        expect(theme.palette.surface).toBeTruthy();
        expect(theme.palette.primary).toBeTruthy();
        expect(theme.palette.text.primary).toBeTruthy();
        expect(theme.palette.text.onPrimary).toBeTruthy();
      }
    }
  });

  test('falls back to the default theme for invalid lookup values', () => {
    expect(getAppTheme('system' as never, 'rainbow' as never)).toBe(getAppTheme(DEFAULT_APP_APPEARANCE, DEFAULT_APP_THEME_SKIN));
  });
});
