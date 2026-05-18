import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { EQ_PRESETS, type EqPresetName } from '../types/Song';

interface EqualizerControls {
  eqEnabled: boolean;
  setEqEnabled: (value: boolean) => void;
  setEqEnabledState: Dispatch<SetStateAction<boolean>>;
  eqBands: number[];
  setEqBand: (index: number, value: number) => void;
  setEqBandsState: Dispatch<SetStateAction<number[]>>;
  eqPreset: EqPresetName | 'custom';
  applyEqPreset: (preset: EqPresetName) => void;
  setEqPreset: Dispatch<SetStateAction<EqPresetName | 'custom'>>;
}

export const updateEqBandAtIndex = (
  bands: number[],
  index: number,
  value: number,
): number[] => {
  const next = bands.slice();
  next[index] = value;
  return next;
};

export const useEqualizerControls = (): EqualizerControls => {
  const [eqEnabled, setEqEnabledState] = useState(false);
  const [eqBands, setEqBandsState] = useState<number[]>(EQ_PRESETS.flat.slice());
  const [eqPreset, setEqPreset] = useState<EqPresetName | 'custom'>('flat');

  const setEqBand = useCallback((index: number, value: number) => {
    setEqBandsState(prev => updateEqBandAtIndex(prev, index, value));
    setEqPreset('custom');
  }, []);

  const applyEqPreset = useCallback((preset: EqPresetName) => {
    setEqBandsState(EQ_PRESETS[preset].slice());
    setEqPreset(preset);
  }, []);

  const setEqEnabled = useCallback((value: boolean) => {
    setEqEnabledState(value);
  }, []);

  return {
    eqEnabled,
    setEqEnabled,
    setEqEnabledState,
    eqBands,
    setEqBand,
    setEqBandsState,
    eqPreset,
    applyEqPreset,
    setEqPreset,
  };
};
