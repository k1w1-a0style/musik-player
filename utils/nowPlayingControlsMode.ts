export type NowPlayingPlayerLayout = 'classic' | 'soundcloud';

// Keep the old exported type name as a compatibility alias while the hook and
// consumers migrate from "controls mode" wording to "player layout" wording.
export type NowPlayingControlsMode = NowPlayingPlayerLayout;

export const NOW_PLAYING_PLAYER_LAYOUTS: readonly NowPlayingPlayerLayout[] = [
  'classic',
  'soundcloud',
] as const;

export const DEFAULT_NOW_PLAYING_PLAYER_LAYOUT: NowPlayingPlayerLayout = 'classic';
export const DEFAULT_NOW_PLAYING_CONTROLS_MODE = DEFAULT_NOW_PLAYING_PLAYER_LAYOUT;

export const NOW_PLAYING_PLAYER_LAYOUT_LABELS: Record<NowPlayingPlayerLayout, string> = {
  classic: 'Klassisch',
  soundcloud: 'SoundCloud',
};

export const NOW_PLAYING_PLAYER_LAYOUT_DESCRIPTIONS: Record<NowPlayingPlayerLayout, string> = {
  classic: 'Cover, Waveform und feste Vor-/Zurück-Buttons.',
  soundcloud: 'Großes Cover als Hintergrund; Waveform im Vordergrund, Tippen = Play/Pause, Wischen = Trackwechsel.',
};

export const isNowPlayingPlayerLayout = (value: unknown): value is NowPlayingPlayerLayout =>
  NOW_PLAYING_PLAYER_LAYOUTS.includes(value as NowPlayingPlayerLayout);

export const normalizeNowPlayingPlayerLayout = (value: unknown): NowPlayingPlayerLayout => {
  if (isNowPlayingPlayerLayout(value)) return value;
  if (value === 'buttons') return 'classic';
  if (value === 'coverSwipe') return 'soundcloud';
  return DEFAULT_NOW_PLAYING_PLAYER_LAYOUT;
};
