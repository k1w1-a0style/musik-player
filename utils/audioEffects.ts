import type { EqInitResult } from 'expo-system-audio';
import {
  clampNativeEqMillibel,
  dbToMillibel,
  findClosestUiEqBandIndex,
} from './nativeEqualizer';

export interface NativeEqBandUpdate {
  index: number;
  millibel: number;
}

export const canUseNativeEq = (eqNative: EqInitResult | null): eqNative is EqInitResult =>
  !!eqNative && eqNative.available;

export const shouldApplyNativeEqBands = (
  eqNative: EqInitResult | null,
  eqEnabled: boolean,
): eqNative is EqInitResult => canUseNativeEq(eqNative) && eqEnabled;

export const buildNativeEqBandUpdates = (
  eqNative: EqInitResult,
  eqBands: number[],
): NativeEqBandUpdate[] => {
  const nativeRange = [eqNative.minMillibel, eqNative.maxMillibel] as const;
  return eqNative.bands.map(band => {
    const uiBandIndex = findClosestUiEqBandIndex(band.centerFreqHz);
    const dB = eqBands[uiBandIndex] ?? 0;
    return {
      index: band.index,
      millibel: clampNativeEqMillibel(dbToMillibel(dB), nativeRange),
    };
  });
};

export const shouldApplyVisualizerFrame = (
  nowMs: number,
  lastUpdateMs: number,
  intervalMs: number,
): boolean => nowMs - lastUpdateMs >= intervalMs;

export const shouldStopVisualizerForPlaybackState = (isPlaying: boolean): boolean => !isPlaying;
