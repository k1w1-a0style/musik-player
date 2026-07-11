export type NowPlayingControlsMode = 'buttons' | 'coverSwipe';

export const NOW_PLAYING_CONTROLS_MODES: readonly NowPlayingControlsMode[] = [
  'buttons',
  'coverSwipe',
] as const;

export const DEFAULT_NOW_PLAYING_CONTROLS_MODE: NowPlayingControlsMode = 'buttons';

export const NOW_PLAYING_CONTROLS_MODE_LABELS: Record<NowPlayingControlsMode, string> = {
  buttons: 'Buttons',
  coverSwipe: 'Cover zusätzlich wischen',
};

export const NOW_PLAYING_CONTROLS_MODE_DESCRIPTIONS: Record<NowPlayingControlsMode, string> = {
  buttons: 'Titelwechsel bleibt über die festen Vor- und Zurück-Buttons erreichbar.',
  coverSwipe: 'Wische zusätzlich auf dem Cover nach links oder rechts, um den Titel zu wechseln; die Buttons bleiben als Alternative sichtbar.',
};

export const isNowPlayingControlsMode = (value: unknown): value is NowPlayingControlsMode =>
  NOW_PLAYING_CONTROLS_MODES.includes(value as NowPlayingControlsMode);
