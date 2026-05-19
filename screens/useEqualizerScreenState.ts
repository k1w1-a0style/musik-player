import { useMemo } from 'react';
import { useMusicContext } from '../contexts/MusicContext';
import { buildEqualizerCurvePath } from './equalizerHelpers';

export const useEqualizerScreenState = () => {
  const {
    eqEnabled,
    setEqEnabled,
    eqBands,
    setEqBand,
    eqPreset,
    applyEqPreset,
    eqNative,
  } = useMusicContext();

  const curvePath = useMemo(() => buildEqualizerCurvePath(eqBands), [eqBands]);

  return {
    eqEnabled,
    setEqEnabled,
    eqBands,
    setEqBand,
    eqPreset,
    applyEqPreset,
    eqNative,
    curvePath,
  };
};
