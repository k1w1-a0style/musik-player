import { useEffect, useState } from 'react';
import SystemAudio, { type EqInitResult } from 'expo-system-audio';
import {
  buildNativeEqBandUpdates,
  canUseNativeEq,
  shouldApplyNativeEqBands,
} from '../utils/audioEffects';

export const useNativeEqualizer = (
  eqEnabled: boolean,
  eqBands: number[],
): EqInitResult | null => {
  const [eqNative, setEqNative] = useState<EqInitResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    SystemAudio.eqInit()
      .then(info => {
        if (!cancelled) setEqNative(info);
      })
      .catch(() => {
        if (!cancelled) setEqNative(null);
      });

    return () => {
      cancelled = true;
      SystemAudio.eqRelease();
    };
  }, []);

  useEffect(() => {
    if (!canUseNativeEq(eqNative)) return;
    SystemAudio.eqSetEnabled(eqEnabled);
  }, [eqEnabled, eqNative]);

  useEffect(() => {
    if (!shouldApplyNativeEqBands(eqNative, eqEnabled)) return;
    buildNativeEqBandUpdates(eqNative, eqBands).forEach(update => {
      SystemAudio.eqSetBandLevel(update.index, update.millibel);
    });
  }, [eqBands, eqEnabled, eqNative]);

  return eqNative;
};
