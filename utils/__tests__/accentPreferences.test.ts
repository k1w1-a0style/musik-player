import { ACCENT_IDS, applyAppAccent, accentContrastRatio, normalizeAccentPreferences, readableAccentForeground } from '../accentPreferences';
import { APP_APPEARANCES, APP_THEME_SKINS, getAppTheme } from '../appTheme';
import { normalizePlayerPresentation } from '../playerPresentation';
import { getSoundCloudWaveformColors } from '../soundCloudWaveformColors';

test('normalizes the twelve independent color choices without changing legacy defaults', () => {
  expect(normalizeAccentPreferences(null)).toEqual({ appAccent: 'neutral', playerAccent: 'cover', instantColors: false });
  for (const id of ACCENT_IDS) {
    expect(normalizeAccentPreferences({ appAccent: id, playerAccent: id, instantColors: true }))
      .toEqual({ appAccent: id, playerAccent: id, instantColors: true });
    expect(normalizePlayerPresentation({ waveformAccent: id }).waveformAccent).toBe(id);
  }
  expect(normalizeAccentPreferences({ appAccent: 'unknown', playerAccent: 42, instantColors: 'true' }))
    .toEqual({ appAccent: 'neutral', playerAccent: 'cover', instantColors: false });
});
test('all accent labels/buttons retain normal-text WCAG contrast in all six themes', () => {
  for (const appearance of APP_APPEARANCES) for (const skin of APP_THEME_SKINS) for (const id of ACCENT_IDS) {
    const theme = applyAppAccent(getAppTheme(appearance, skin), id, '#030005');
    for (const surface of [theme.palette.background, theme.palette.surface, theme.palette.surfaceElevated]) {
      expect(accentContrastRatio(theme.palette.primary, surface)).toBeGreaterThanOrEqual(4.5);
    }
    expect(accentContrastRatio(theme.palette.primary, readableAccentForeground(theme.palette.primary))).toBeGreaterThanOrEqual(4.5);
  }
});
test('all waveform selections distinguish played / unplayed at 3:1 or more', () => {
  for (const id of ACCENT_IDS) {
    const colors = getSoundCloudWaveformColors('#000000', id);
    expect(accentContrastRatio(colors.played, colors.unplayed)).toBeGreaterThanOrEqual(3);
    expect(accentContrastRatio(colors.played, '#151515')).toBeGreaterThanOrEqual(3);
  }
});
