import { SOUNDCLOUD_PLAYER_COLORS } from './appThemeOverlays';

/** Keep the two timeline halves distinguishable even for white/black artwork. */
export const getSoundCloudWaveformColors = (accent: string): { unplayed: string; played: string } => {
  const match = /^#([0-9a-f]{6})$/i.exec(accent);
  const rgb = match ? [0, 2, 4].map(offset => parseInt(match[1].slice(offset, offset + 2), 16)) : [];
  const max = Math.max(...rgb);
  const min = Math.min(...rgb);
  const suitable = rgb.length === 3 && max >= 140 && max - min >= 65
    && (rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722) >= 85;
  const unplayed = suitable ? accent : SOUNDCLOUD_PLAYER_COLORS.accent;
  const played = '#' + [1, 3, 5].map(offset =>
    Math.round(parseInt(unplayed.slice(offset, offset + 2), 16) * 0.55).toString(16).padStart(2, '0'),
  ).join('');
  return { unplayed, played };
};
