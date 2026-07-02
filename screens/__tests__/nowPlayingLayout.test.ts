import { buildNowPlayingLayoutMetrics } from '../nowPlayingLayout';

describe('buildNowPlayingLayoutMetrics', () => {
  test('builds layout metrics from measured content dimensions', () => {
    expect(buildNowPlayingLayoutMetrics({ width: 400, height: 704 })).toEqual({
      coverSize: 281,
      coverAreaHeight: 299,
      queueCardMaxHeight: 620,
      glowLeft: 70,
      snapPageHeight: 704,
      detailPageListHeight: 620,
    });
  });

  test('uses the available height after header and safe-area have been subtracted', () => {
    const windowHeight = 800;
    const headerAndInsets = 96;
    const metrics = buildNowPlayingLayoutMetrics({ width: 400, height: windowHeight - headerAndInsets });

    expect(metrics.snapPageHeight).toBe(704);
    expect(metrics.detailPageListHeight).toBe(620);
  });

  test('clamps cover and leaves room for controls on small screens with multi-line titles', () => {
    const small = buildNowPlayingLayoutMetrics({ width: 320, height: 456 });

    expect(small.coverSize).toBe(156);
    expect(small.coverAreaHeight).toBe(168);
    expect(small.detailPageListHeight).toBe(372);
    expect(small.snapPageHeight).toBe(456);
    expect(small.glowLeft).toBe(30);
  });

  test('cover size is clamped by width on narrow screens', () => {
    const narrow = buildNowPlayingLayoutMetrics({ width: 220, height: 900 });

    expect(narrow.coverSize).toBe(172);
    expect(narrow.coverAreaHeight).toBe(190);
  });

  test('expands queue height for large measured content areas', () => {
    const large = buildNowPlayingLayoutMetrics({ width: 700, height: 1100 });

    expect(large.coverSize).toBe(440);
    expect(large.queueCardMaxHeight).toBe(1016);
    expect(large.snapPageHeight).toBe(1100);
    expect(large.detailPageListHeight).toBe(1016);
  });
});
