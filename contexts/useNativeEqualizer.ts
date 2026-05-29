import { useEffect, useState } from 'react';
import type { EqInitResult } from 'expo-system-audio';
import {
  applyNativeEqualizerBands,
  applyNativeEqualizerEnabled,
  initNativeEqualizer,
  releaseNativeEqualizer,
} from './nativeEqualizerHelpers';

export const useNativeEqualizer = (
  eqEnabled: boolean,
  eqBands: number[],
): EqInitResult | null => {
  const [eqNative, setEqNative] = useState<EqInitResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    initNativeEqualizer().then(info => {
      if (!cancelled) setEqNative(info);
    });

    return () => {
      cancelled = true;
      releaseNativeEqualizer();
    };
  }, []);

  useEffect(() => {
    applyNativeEqualizerEnabled(eqNative, eqEnabled);
  }, [eqEnabled, eqNative]);

  useEffect(() => {
    applyNativeEqualizerBands(eqNative, eqEnabled, eqBands);
  }, [eqBands, eqEnabled, eqNative]);

  return eqNative;
};
