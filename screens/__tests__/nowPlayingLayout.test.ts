import { buildNowPlayingLayoutMetrics } from '../nowPlayingLayout';

describe('buildNowPlayingLayoutMetrics', () => {
  test('builds layout metrics from screen dimensions', () => {
    expect(buildNowPlayingLayoutMetrics({ width: 400, height: 800 })).toEqual({
      coverSize: 336,
      coverAreaHeight: 360,
      queueCardMaxHeight: 360,
      glowLeft: 70,
      snapPageHeight: 800,
      detailPageListHeight: 496,
    });
  });

  test('clamps cover and queue heights for small screens', () => {
    const small = buildNowPlayingLayoutMetrics({ width: 300, height: 500 });
    expect(small.coverSize).toBe(220);
    expect(small.coverAreaHeight).toBe(244);
    expect(small.queueCardMaxHeight).toBe(250);
    expect(small.snapPageHeight).toBe(500);
    expect(small.detailPageListHeight).toBe(320);
    expect(small.glowLeft).toBe(20);
  });

  test('clamps cover and queue heights for large screens', () => {
    const large = buildNowPlayingLayoutMetrics({ width: 700, height: 1200 });
    expect(large.coverSize).toBe(504);
    expect(large.queueCardMaxHeight).toBe(360);
    expect(large.snapPageHeight).toBe(1200);
    expect(large.detailPageListHeight).toBe(744);
  });

  test('snapPageHeight has a 480 floor for tiny screens', () => {
    expect(buildNowPlayingLayoutMetrics({ width: 320, height: 320 }).snapPageHeight).toBe(480);
  });
});
