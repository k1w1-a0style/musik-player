import SystemAudio, { type EqInitResult } from 'expo-system-audio';
import {
  applyNativeEqualizerBands,
  applyNativeEqualizerEnabled,
  initNativeEqualizer,
  releaseNativeEqualizer,
} from '../nativeEqualizerHelpers';

const eqNative: EqInitResult = {
  available: true,
  enabled: false,
  minMillibel: -300,
  maxMillibel: 300,
  bands: [
    { index: 0, centerFreqHz: 60 },
    { index: 1, centerFreqHz: 1000 },
  ],
};

describe('nativeEqualizerHelpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('initializes native equalizer and returns null on failure', async () => {
    jest.spyOn(SystemAudio, 'eqInit').mockResolvedValueOnce(eqNative);
    await expect(initNativeEqualizer()).resolves.toEqual(eqNative);

    jest.spyOn(SystemAudio, 'eqInit').mockRejectedValueOnce(new Error('failed'));
    await expect(initNativeEqualizer()).resolves.toBeNull();
  });

  test('releases native equalizer', () => {
    releaseNativeEqualizer();

    expect(SystemAudio.eqRelease).toHaveBeenCalled();
  });

  test('applies enabled state only when native equalizer is available', () => {
    applyNativeEqualizerEnabled(eqNative, true);
    applyNativeEqualizerEnabled({ ...eqNative, available: false }, true);

    expect(SystemAudio.eqSetEnabled).toHaveBeenCalledTimes(1);
    expect(SystemAudio.eqSetEnabled).toHaveBeenCalledWith(true);
  });

  test('applies band levels only when enabled and available', () => {
    applyNativeEqualizerBands(eqNative, true, [5, 0, 0, 0, 2, 0, 0, 0, 0, -5]);
    applyNativeEqualizerBands(eqNative, false, [5, 0, 0, 0, 2, 0, 0, 0, 0, -5]);

    expect(SystemAudio.eqSetBandLevel).toHaveBeenCalledTimes(2);
    expect(SystemAudio.eqSetBandLevel).toHaveBeenCalledWith(0, 300);
    expect(SystemAudio.eqSetBandLevel).toHaveBeenCalledWith(1, 200);
  });
});
