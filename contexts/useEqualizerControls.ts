import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import type { EqPresetName } from '../types/Song';
import {
  createDefaultEqBands,
  getEqPresetBands,
  updateEqBandAtIndex,
} from './equalizerControlHelpers';

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

export { updateEqBandAtIndex } from './equalizerControlHelpers';

export const useEqualizerControls = (): EqualizerControls => {
  const [eqEnabled, setEqEnabledState] = useState(false);
  const [eqBands, setEqBandsState] = useState<number[]>(createDefaultEqBands);
  const [eqPreset, setEqPreset] = useState<EqPresetName | 'custom'>('flat');

  const setEqBand = useCallback((index: number, value: number) => {
    setEqBandsState(prev => updateEqBandAtIndex(prev, index, value));
    setEqPreset('custom');
  }, []);

  const applyEqPreset = useCallback((preset: EqPresetName) => {
    setEqBandsState(getEqPresetBands(preset));
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
