import {
  DEFAULT_NOW_PLAYING_CONTROLS_MODE,
  NOW_PLAYING_CONTROLS_MODE_DESCRIPTIONS,
  NOW_PLAYING_CONTROLS_MODE_LABELS,
  NOW_PLAYING_CONTROLS_MODES,
  isNowPlayingControlsMode,
} from '../nowPlayingControlsMode';

test('defines the default player mode', () => {
  expect(DEFAULT_NOW_PLAYING_CONTROLS_MODE).toBe('buttons');
  expect(NOW_PLAYING_CONTROLS_MODES).toEqual(['buttons', 'coverSwipe']);
});

test('checks player mode values', () => {
  expect(isNowPlayingControlsMode('buttons')).toBe(true);
  expect(isNowPlayingControlsMode('coverSwipe')).toBe(true);
  expect(isNowPlayingControlsMode('swipe')).toBe(false);
  expect(isNowPlayingControlsMode(null)).toBe(false);
});

test('has labels and descriptions for every player mode', () => {
  for (const mode of NOW_PLAYING_CONTROLS_MODES) {
    expect(NOW_PLAYING_CONTROLS_MODE_LABELS[mode]).toEqual(expect.any(String));
    expect(NOW_PLAYING_CONTROLS_MODE_DESCRIPTIONS[mode]).toEqual(expect.any(String));
  }
});

test('describes cover swipe as an available gesture', () => {
  expect(NOW_PLAYING_CONTROLS_MODE_LABELS.coverSwipe).toBe('Cover zusätzlich wischen');
  expect(NOW_PLAYING_CONTROLS_MODE_DESCRIPTIONS.coverSwipe).toBe(
    'Wische zusätzlich auf dem Cover nach links oder rechts, um den Titel zu wechseln; die Buttons bleiben als Alternative sichtbar.',
  );
});
