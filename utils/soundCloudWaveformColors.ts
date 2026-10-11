import { SOUNDCLOUD_PLAYER_COLORS } from './appThemeOverlays';
import type { WaveformAccent } from './playerPresentation';

const fixedColors = {
  neutral: SOUNDCLOUD_PLAYER_COLORS.waveformNeutral,
  orange: SOUNDCLOUD_PLAYER_COLORS.accent,
  blue: SOUNDCLOUD_PLAYER_COLORS.waveformBlue,
};
const linearChannel = (value: number): number => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const hexChannel = (value: number): string => {
  const srgb = value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(1, srgb)) * 255).toString(16).padStart(2, '0');
};
/** Keep cover hue while bounding its brightness against the dark surface and neutral future. */
const readableCoverAccent = (accent?: string): string => {
  if (!accent || !/^#[0-9a-f]{6}$/i.test(accent)) return fixedColors.blue;
  const rgb = [1, 3, 5].map(offset => linearChannel(parseInt(accent.slice(offset, offset + 2), 16) / 255));
  const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  const output = luminance > 0.24 ? rgb.map(channel => channel * 0.24 / luminance)
    : luminance < 0.14 ? rgb.map(channel => channel + (1 - channel) * (0.14 - luminance) / (1 - luminance)) : rgb;
  return `#${output.map(hexChannel).join('')}`;
};
export const getSoundCloudWaveformColors = (accent?: string, selection: WaveformAccent = 'cover') => ({
  unplayed: SOUNDCLOUD_PLAYER_COLORS.waveformRest,
  played: selection === 'cover' ? readableCoverAccent(accent) : fixedColors[selection],
});
