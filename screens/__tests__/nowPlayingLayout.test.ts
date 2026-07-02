import { buildNowPlayingLayoutMetrics } from '../nowPlayingLayout';

describe('buildNowPlayingLayoutMetrics', () => {
  test('builds layout metrics from screen dimensions', () => {
    expect(buildNowPlayingLayoutMetrics({ width: 400, height: 800 })).toEqual({
      coverSize: 336,
      coverAreaHeight: 360,
      queueCardMaxHeight: 624,
      glowLeft: 70,
      snapPageHeight: 800,
      detailPageListHeight: 624,
    });
  });

  test('clamps cover and keeps a useful queue height for small screens', () => {
    const small = buildNowPlayingLayoutMetrics({ width: 300, height: 500 });
    expect(small.coverSize).toBe(220);
    expect(small.coverAreaHeight).toBe(244);
    expect(small.queueCardMaxHeight).toBe(420);
    expect(small.snapPageHeight).toBe(500);
    expect(small.detailPageListHeight).toBe(420);
    expect(small.glowLeft).toBe(20);
  });

  test('expands queue height for large screens', () => {
    const large = buildNowPlayingLayoutMetrics({ width: 700, height: 1200 });
    expect(large.coverSize).toBe(504);
    expect(large.queueCardMaxHeight).toBe(936);
    expect(large.snapPageHeight).toBe(1200);
    expect(large.detailPageListHeight).toBe(936);
  });

  test('snapPageHeight has a 480 floor for tiny screens', () => {
    expect(buildNowPlayingLayoutMetrics({ width: 320, height: 320 }).snapPageHeight).toBe(480);
  });
});
