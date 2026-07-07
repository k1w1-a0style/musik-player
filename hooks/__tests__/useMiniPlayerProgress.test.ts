import { clampMiniPlayerProgress, getMiniPlayerProgressRatio } from '../useMiniPlayerProgress';

describe('useMiniPlayerProgress helpers', () => {
  test.each([
    [0, 0],
    [0.25, 0.25],
    [1, 1],
    [1.5, 1],
    [-0.5, 0],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
  ])('clamps %p to %p', (input, expected) => {
    expect(clampMiniPlayerProgress(input)).toBe(expected);
  });

  test.each([
    [25_000, 100_000, 0.25],
    [120_000, 100_000, 1],
    [-5_000, 100_000, 0],
    [10_000, 0, 0],
    [10_000, Number.NaN, 0],
    [Number.NaN, 10_000, 0],
  ])('returns a safe progress ratio for position %p and duration %p', (position, duration, expected) => {
    expect(getMiniPlayerProgressRatio(position, duration)).toBe(expected);
  });
});
