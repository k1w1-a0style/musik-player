import { clampPlaybackProgressValues } from '../ProgressBar';

describe('ProgressBar playback value guards', () => {
  test('clamps invalid position and duration values to stable display values', () => {
    expect(clampPlaybackProgressValues(Number.NaN, 1000)).toEqual({
      currentPosition: 0,
      duration: 1000,
      progress: 0,
    });
    expect(clampPlaybackProgressValues(-500, 1000)).toEqual({
      currentPosition: 0,
      duration: 1000,
      progress: 0,
    });
    expect(clampPlaybackProgressValues(1500, 1000)).toEqual({
      currentPosition: 1000,
      duration: 1000,
      progress: 100,
    });
    expect(clampPlaybackProgressValues(500, Number.POSITIVE_INFINITY)).toEqual({
      currentPosition: 0,
      duration: 0,
      progress: 0,
    });
  });
});
