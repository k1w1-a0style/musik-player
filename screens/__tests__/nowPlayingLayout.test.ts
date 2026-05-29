import { buildNowPlayingLayoutMetrics } from '../nowPlayingLayout';

describe('buildNowPlayingLayoutMetrics', () => {
  test('builds layout metrics from screen dimensions', () => {
    expect(buildNowPlayingLayoutMetrics({ width: 400, height: 800 })).toEqual({
      coverSize: 160,
      coverAreaHeight: 168,
      queueCardMaxHeight: 216,
      glowLeft: 70,
    });
  });

  test('clamps cover and queue heights', () => {
    expect(buildNowPlayingLayoutMetrics({ width: 300, height: 500 })).toEqual({
      coverSize: 140,
      coverAreaHeight: 148,
      queueCardMaxHeight: 135,
      glowLeft: 20,
    });

    expect(buildNowPlayingLayoutMetrics({ width: 700, height: 1200 })).toEqual({
      coverSize: 240,
      coverAreaHeight: 248,
      queueCardMaxHeight: 236,
      glowLeft: 220,
    });
  });
});
