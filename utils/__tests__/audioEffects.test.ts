import {
  buildNativeEqBandUpdates,
  canUseNativeEq,
  shouldApplyNativeEqBands,
} from '../audioEffects';
import type { EqInitResult } from 'expo-system-audio';

const eqNative: EqInitResult = {
  available: true,
  enabled: true,
  minMillibel: -300,
  maxMillibel: 300,
  bands: [
    { index: 0, centerFreqHz: 60 },
    { index: 1, centerFreqHz: 1000 },
    { index: 2, centerFreqHz: 16000 },
  ],
};

describe('audioEffects helpers', () => {
  test('checks native EQ availability', () => {
    expect(canUseNativeEq(eqNative)).toBe(true);
    expect(canUseNativeEq({ ...eqNative, available: false })).toBe(false);
    expect(canUseNativeEq(null)).toBe(false);
  });

  test('checks whether native EQ bands should be applied', () => {
    expect(shouldApplyNativeEqBands(eqNative, true)).toBe(true);
    expect(shouldApplyNativeEqBands(eqNative, false)).toBe(false);
    expect(shouldApplyNativeEqBands(null, true)).toBe(false);
  });

  test('builds clamped native EQ band updates from UI bands', () => {
    const updates = buildNativeEqBandUpdates(eqNative, [5, 0, 0, 0, 2, 0, 0, 0, 0, -5]);

    expect(updates).toEqual([
      { index: 0, millibel: 300 },
      { index: 1, millibel: 200 },
      { index: 2, millibel: -300 },
    ]);
  });

});
