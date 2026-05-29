import { EQ_BAND_COUNT, EQ_PRESETS, type EqPresetName } from '../types/Song';

export const MIN_EQ_GAIN = -12;
export const MAX_EQ_GAIN = 12;

export const createDefaultEqBands = (): number[] => EQ_PRESETS.flat.slice();

export const clampEqBandGain = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(MIN_EQ_GAIN, Math.min(MAX_EQ_GAIN, value));
};

export const isValidEqBandIndex = (index: number): boolean =>
  Number.isInteger(index) && index >= 0 && index < EQ_BAND_COUNT;

export const updateEqBandAtIndex = (
  bands: number[],
  index: number,
  value: number,
): number[] => {
  if (!isValidEqBandIndex(index)) return bands.slice();
  const next = bands.slice(0, EQ_BAND_COUNT);
  while (next.length < EQ_BAND_COUNT) next.push(0);
  next[index] = clampEqBandGain(value);
  return next;
};

export const getEqPresetBands = (preset: EqPresetName): number[] => EQ_PRESETS[preset].slice();