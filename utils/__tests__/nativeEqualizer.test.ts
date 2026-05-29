import {
  clampNativeEqMillibel,
  dbToMillibel,
  findClosestUiEqBandIndex,
  UI_EQ_FREQUENCIES_HZ,
} from '../nativeEqualizer';

describe('nativeEqualizer helpers', () => {
  test('exposes the expected ten-band UI frequencies', () => {
    expect(UI_EQ_FREQUENCIES_HZ).toEqual([60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000]);
  });

  test('finds the closest UI band index for native center frequencies', () => {
    expect(findClosestUiEqBandIndex(55)).toBe(0);
    expect(findClosestUiEqBandIndex(650)).toBe(3);
    expect(findClosestUiEqBandIndex(2800)).toBe(5);
    expect(findClosestUiEqBandIndex(15000)).toBe(8);
  });

  test('converts db values to millibel', () => {
    expect(dbToMillibel(3)).toBe(300);
    expect(dbToMillibel(-2.25)).toBe(-225);
  });

  test('clamps native millibel values to device range', () => {
    expect(clampNativeEqMillibel(500, [-300, 300])).toBe(300);
    expect(clampNativeEqMillibel(-500, [-300, 300])).toBe(-300);
    expect(clampNativeEqMillibel(120, [-300, 300])).toBe(120);
  });
});
