import SystemAudio, { type EqInitResult } from 'expo-system-audio';
import { NativeModules } from 'react-native';
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
    (NativeModules.TrackPlayerModule.getAudioSessionId as jest.Mock).mockResolvedValue(17);
  });

  test('initializes native equalizer and returns null on failure', async () => {
    jest.spyOn(SystemAudio, 'eqInit').mockResolvedValueOnce(eqNative);
    await expect(initNativeEqualizer()).resolves.toEqual(eqNative);
    expect(SystemAudio.eqInit).toHaveBeenCalledWith(17);

    jest.spyOn(SystemAudio, 'eqInit').mockRejectedValueOnce(new Error('failed'));
    await expect(initNativeEqualizer()).resolves.toBeNull();
  });


  test('serializes native initialization so a stale session cannot replace a newer one', async () => {
    let resolveFirst!: (value: EqInitResult) => void;
    let markFirstStarted!: () => void;
    const firstStarted = new Promise<void>(resolve => {
      markFirstStarted = resolve;
    });
    jest.spyOn(SystemAudio, 'eqInit')
      .mockImplementationOnce(() => new Promise(resolve => {
        markFirstStarted();
        resolveFirst = resolve;
      }))
      .mockResolvedValueOnce(eqNative);

    const first = initNativeEqualizer();
    const second = initNativeEqualizer();
    await firstStarted;

    expect(SystemAudio.eqInit).toHaveBeenCalledTimes(1);
    resolveFirst(eqNative);
    await expect(first).resolves.toEqual(eqNative);
    await expect(second).resolves.toEqual(eqNative);
    expect(SystemAudio.eqInit).toHaveBeenCalledTimes(2);
  });

  test('fails closed without a valid TrackPlayer audio session', async () => {
    (NativeModules.TrackPlayerModule.getAudioSessionId as jest.Mock).mockResolvedValue(0);
    const controller = new AbortController();
    controller.abort();

    await expect(initNativeEqualizer(controller.signal)).resolves.toBeNull();
    expect(SystemAudio.eqInit).not.toHaveBeenCalled();
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
