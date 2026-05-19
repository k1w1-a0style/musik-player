import {
  buildEqualizerCurvePath,
  formatHz,
  PRESET_KEYS,
  PRESET_LABELS,
} from '../equalizerHelpers';

describe('equalizerHelpers', () => {
  test('formats frequencies', () => {
    expect(formatHz(60)).toBe('60');
    expect(formatHz(1000)).toBe('1.0k');
    expect(formatHz(12500)).toBe('12.5k');
  });

  test('exposes preset keys and labels', () => {
    expect(PRESET_KEYS).toContain('flat');
    expect(PRESET_KEYS).toContain('bassBoost');
    expect(PRESET_LABELS.bassBoost).toBe('Bass+');
  });

  test('builds fallback curve for empty or single band input', () => {
    expect(buildEqualizerCurvePath([], 320, 80)).toBe('M0,40 L320,40');
    expect(buildEqualizerCurvePath([0], 320, 80)).toBe('M0,40 L320,40');
  });

  test('builds bezier curve from eq bands', () => {
    const path = buildEqualizerCurvePath([12, 0, -12], 300, 60);

    expect(path).toBe('M 0 0 C 50 0, 100 30, 150 30 C 200 30, 250 60, 300 60');
  });
});
