import {
  buildNativeEqBandUpdates,
  canUseNativeEq,
  shouldApplyNativeEqBands,
  shouldApplyVisualizerFrame,
  shouldStopVisualizerForPlaybackState,
} from '../audioEffects';
import type { EqInitResult } from 'expo-system-audio';

const eqNative: EqInitResult = {
  available: true,
  minMillibel: -300,
  maxMillibel: 300,
  bands: [
    { index: 0, centerFreqHz: 60, levelMillibel: 0 },
    { index: 1, centerFreqHz: 1000, levelMillibel: 0 },
    { index: 2, centerFreqHz: 16000, levelMillibel: 0 },
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

  test('throttles visualizer frames by interval', () => {
    expect(shouldApplyVisualizerFrame(100, 0, 120)).toBe(false);
    expect(shouldApplyVisualizerFrame(120, 0, 120)).toBe(true);
    expect(shouldApplyVisualizerFrame(250, 120, 120)).toBe(true);
  });

  test('stops visualizer while playback is not running', () => {
    expect(shouldStopVisualizerForPlaybackState(false)).toBe(true);
    expect(shouldStopVisualizerForPlaybackState(true)).toBe(false);
  });
});
