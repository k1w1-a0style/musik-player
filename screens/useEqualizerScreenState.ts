import { useMemo } from 'react';
import { useEqualizerMusicContext } from '../contexts/MusicContext';
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
  } = useEqualizerMusicContext();

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
