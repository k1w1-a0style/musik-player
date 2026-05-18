import { EQ_PRESETS, type EqPresetName } from '../types/Song';

export const createDefaultEqBands = (): number[] => EQ_PRESETS.flat.slice();

export const updateEqBandAtIndex = (
  bands: number[],
  index: number,
  value: number,
): number[] => {
  const next = bands.slice();
  next[index] = value;
  return next;
};

export const getEqPresetBands = (preset: EqPresetName): number[] => EQ_PRESETS[preset].slice();
