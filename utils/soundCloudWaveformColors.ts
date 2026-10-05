import { SOUNDCLOUD_PLAYER_COLORS } from './appThemeOverlays';

/** Stable timeline colors, independent of the artwork palette. */
export const getSoundCloudWaveformColors = (_accent?: string): { unplayed: string; played: string } => ({
  unplayed: SOUNDCLOUD_PLAYER_COLORS.waveformRest, played: SOUNDCLOUD_PLAYER_COLORS.accent,
});
