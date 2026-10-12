import type { AppTheme } from './appTheme';

export const ACCENT_IDS = ['cover', 'green', 'cyan', 'turquoise', 'blue', 'violet', 'purple', 'pink', 'red', 'orange', 'yellow', 'neutral'] as const;
export type AccentId = typeof ACCENT_IDS[number];
export const ACCENT_LABELS: Record<AccentId, string> = { cover: 'Coverautomatik', green: 'Grün', cyan: 'Cyan',
  turquoise: 'Türkis', blue: 'Blau', violet: 'Violett', purple: 'Lila', pink: 'Pink', red: 'Rot',
  orange: 'Orange', yellow: 'Gelb', neutral: 'Neutral' };
export const ACCENT_COLORS: Record<Exclude<AccentId, 'cover'>, string> = { green: '#36B978', cyan: '#29C7EB',
  turquoise: '#2ABBAA', blue: '#4885C5', violet: '#7772E9', purple: '#B665D2', pink: '#E967AC',
  red: '#E75D64', orange: '#FF5500', yellow: '#E3B533', neutral: '#858585' };
export interface AccentPreferences { appAccent: AccentId; playerAccent: AccentId; instantColors: boolean }
export const ACCENT_PREFERENCES_KEY = 'accentPreferencesV4';
export const DEFAULT_ACCENT_PREFERENCES: Readonly<AccentPreferences> = Object.freeze({
  appAccent: 'neutral', playerAccent: 'cover', instantColors: false,
});
export const isAccentId = (value: unknown): value is AccentId => ACCENT_IDS.includes(value as AccentId);
export const normalizeAccentPreferences = (value: unknown): AccentPreferences => {
  const source = value && typeof value === 'object' ? value as Partial<AccentPreferences> : {};
  return { appAccent: isAccentId(source.appAccent) ? source.appAccent : 'neutral',
    playerAccent: isAccentId(source.playerAccent) ? source.playerAccent : 'cover', instantColors: source.instantColors === true };
};
export const resolveAccentColor = (id: AccentId, coverColor: string): string => id === 'cover' ? coverColor : ACCENT_COLORS[id];

const channels = (hex: string): number[] => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
const luminance = (hex: string): number => channels(hex).map(value => {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
export const accentContrastRatio = (left: string, right: string): number => {
  const a = luminance(left); const b = luminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};
const mixHex = (hex: string, target: number, fraction: number): string => `#${channels(hex)
  .map(value => Math.round(value + (target - value) * fraction).toString(16).padStart(2, '0')).join('')}`;

/** WCAG normal-text contrast for accent labels on the app's opaque surfaces. */
export const readableAppAccent = (color: string, theme: AppTheme): string => {
  const base = /^#[0-9a-f]{6}$/i.test(color) ? color : theme.palette.primary;
  const surfaces = [theme.palette.background, theme.palette.surface, theme.palette.surfaceElevated];
  if (surfaces.every(surface => accentContrastRatio(base, surface) >= 4.5)) return base;
  for (let step = 1; step <= 100; step += 1) {
    const candidate = mixHex(base, theme.appearance === 'light' ? 0 : 255, step / 100);
    if (surfaces.every(surface => accentContrastRatio(candidate, surface) >= 4.5)) return candidate;
  }
  return theme.appearance === 'light' ? '#000000' : '#ffffff';
};
export const readableAccentForeground = (color: string): string => accentContrastRatio(color, '#FFFFFF')
  >= accentContrastRatio(color, '#0A0B0C') ? '#FFFFFF' : '#0A0B0C';

export const applyAppAccent = (theme: AppTheme, id: AccentId, coverColor?: string): AppTheme => {
  const selected = id === 'neutral' ? theme.palette.primary : resolveAccentColor(id, coverColor ?? theme.palette.primary);
  const primary = readableAppAccent(selected, theme);
  if (id === 'neutral' && primary === theme.palette.primary) return theme;
  const accent = id === 'neutral' ? readableAppAccent(theme.palette.accent, theme) : primary;
  return { ...theme, palette: { ...theme.palette, primary, accent,
    primaryDark: primary, primaryGlow: `${primary}24`, accentGlow: `${primary}1c`,
    text: { ...theme.palette.text, onPrimary: readableAccentForeground(primary) } } };
};
