import {
  APP_APPEARANCE_LABELS,
  APP_APPEARANCES,
  APP_THEME_SKIN_LABELS,
  APP_THEME_SKINS,
  APP_THEME_TOKENS,
  DEFAULT_APP_APPEARANCE,
  DEFAULT_APP_THEME_SKIN,
  getAppTheme,
  isAppAppearance,
  isAppThemeSkin,
  normalizeAppAppearance,
  normalizeAppThemeSkin,
} from '../appTheme';

type Rgb = readonly [number, number, number];

const parseHexRgb = (value: string): Rgb => [
  Number.parseInt(value.slice(1, 3), 16),
  Number.parseInt(value.slice(3, 5), 16),
  Number.parseInt(value.slice(5, 7), 16),
];

const compositeRgbaOver = (value: string, background: Rgb): Rgb => {
  const match = value.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/);
  if (!match) throw new Error(`Expected rgba color, received ${value}`);
  const foreground: Rgb = [Number(match[1]), Number(match[2]), Number(match[3])];
  const alpha = Number(match[4]);
  return foreground.map((channel, index) =>
    channel * alpha + background[index] * (1 - alpha)) as unknown as Rgb;
};

const relativeLuminance = (rgb: Rgb): number => rgb
  .map(channel => channel / 255)
  .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);

const contrastRatio = (foreground: Rgb, background: Rgb): number => {
  const light = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const dark = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (light + 0.05) / (dark + 0.05);
};

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
        expect(theme.tokens).toBe(APP_THEME_TOKENS);
        expect(theme.tokens.spacing.md).toBe(14);
        expect(theme.tokens.radii.card).toBe(14);
        expect(theme.tokens.fonts.heading).toBe('Bricolage-SemiBold');
        expect(theme.tokens.typography.body.lineHeight).toBe(20);
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

  test('keeps muted light-theme text above WCAG AA contrast on theme surfaces', () => {
    for (const skin of APP_THEME_SKINS) {
      const { palette } = getAppTheme('light', skin);
      const surfaces = [
        palette.background,
        palette.backgroundDeep,
        palette.surface,
        palette.surfaceElevated,
        palette.card,
        palette.cardElevated,
      ];
      for (const surface of surfaces) {
        const background = parseHexRgb(surface);
        const foreground = compositeRgbaOver(palette.text.muted, background);
        expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  test('falls back to the default theme for invalid lookup values', () => {
    expect(getAppTheme('system' as never, 'rainbow' as never)).toBe(getAppTheme(DEFAULT_APP_APPEARANCE, DEFAULT_APP_THEME_SKIN));
  });
});
