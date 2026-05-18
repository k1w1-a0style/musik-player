import type { EqInitResult } from 'expo-system-audio';

export const UI_EQ_FREQUENCIES_HZ = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000] as const;

export const findClosestUiEqBandIndex = (centerFreqHz: number): number => {
  let bestIdx = 0;
  let bestDist = Infinity;
  UI_EQ_FREQUENCIES_HZ.forEach((freq, index) => {
    const dist = Math.abs(freq - centerFreqHz);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = index;
    }
  });
  return bestIdx;
};

export const clampNativeEqMillibel = (
  millibel: number,
  bandLevelRange: EqInitResult['bands'][number] extends never ? readonly [number, number] : readonly [number, number],
): number => Math.max(bandLevelRange[0], Math.min(bandLevelRange[1], millibel));

export const dbToMillibel = (db: number): number => Math.round(db * 100);
