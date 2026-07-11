import {
  DEFAULT_NOW_PLAYING_PLAYER_LAYOUT,
  NOW_PLAYING_PLAYER_LAYOUT_DESCRIPTIONS,
  NOW_PLAYING_PLAYER_LAYOUT_LABELS,
  NOW_PLAYING_PLAYER_LAYOUTS,
  isNowPlayingPlayerLayout,
  normalizeNowPlayingPlayerLayout,
} from '../nowPlayingControlsMode';

test('defines the default player layout', () => {
  expect(DEFAULT_NOW_PLAYING_PLAYER_LAYOUT).toBe('classic');
  expect(NOW_PLAYING_PLAYER_LAYOUTS).toEqual(['classic', 'soundcloud']);
});

test('checks player layout values', () => {
  expect(isNowPlayingPlayerLayout('classic')).toBe(true);
  expect(isNowPlayingPlayerLayout('soundcloud')).toBe(true);
  expect(isNowPlayingPlayerLayout('coverSwipe')).toBe(false);
  expect(isNowPlayingPlayerLayout(null)).toBe(false);
});

test('migrates old controls mode values into player layouts', () => {
  expect(normalizeNowPlayingPlayerLayout('buttons')).toBe('classic');
  expect(normalizeNowPlayingPlayerLayout('coverSwipe')).toBe('soundcloud');
  expect(normalizeNowPlayingPlayerLayout('sideways-toaster')).toBe('classic');
});

test('has labels and descriptions for every player layout', () => {
  for (const layout of NOW_PLAYING_PLAYER_LAYOUTS) {
    expect(NOW_PLAYING_PLAYER_LAYOUT_LABELS[layout]).toEqual(expect.any(String));
    expect(NOW_PLAYING_PLAYER_LAYOUT_DESCRIPTIONS[layout]).toEqual(expect.any(String));
  }
});

test('describes the SoundCloud layout as the swipe-based player view', () => {
  expect(NOW_PLAYING_PLAYER_LAYOUT_LABELS.soundcloud).toBe('SoundCloud');
  expect(NOW_PLAYING_PLAYER_LAYOUT_DESCRIPTIONS.soundcloud).toContain('Wischen = Trackwechsel');
});
