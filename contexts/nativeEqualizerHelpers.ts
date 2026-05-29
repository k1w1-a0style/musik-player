import SystemAudio, { type EqInitResult } from 'expo-system-audio';
import {
  buildNativeEqBandUpdates,
  canUseNativeEq,
  shouldApplyNativeEqBands,
} from '../utils/audioEffects';

export const initNativeEqualizer = async (): Promise<EqInitResult | null> => {
  try {
    return await SystemAudio.eqInit();
  } catch {
    return null;
  }
};

export const releaseNativeEqualizer = (): void => {
  SystemAudio.eqRelease();
};

export const applyNativeEqualizerEnabled = (
  eqNative: EqInitResult | null,
  eqEnabled: boolean,
): void => {
  if (!canUseNativeEq(eqNative)) return;
  SystemAudio.eqSetEnabled(eqEnabled);
};

export const applyNativeEqualizerBands = (
  eqNative: EqInitResult | null,
  eqEnabled: boolean,
  eqBands: number[],
): void => {
  if (!shouldApplyNativeEqBands(eqNative, eqEnabled)) return;
  buildNativeEqBandUpdates(eqNative, eqBands).forEach(update => {
    SystemAudio.eqSetBandLevel(update.index, update.millibel);
  });
};
