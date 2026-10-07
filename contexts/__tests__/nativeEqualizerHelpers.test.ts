import SystemAudio, { type EqInitResult } from 'expo-system-audio';
import TrackPlayer from 'react-native-track-player';
import {
  applyNativeEqualizerBands,
  applyNativeEqualizerEnabled,
  createNativeEqualizerBandScheduler,
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
    jest.mocked(TrackPlayer.getAudioSessionId).mockResolvedValue(17);
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
    jest.mocked(TrackPlayer.getAudioSessionId).mockResolvedValue(0);
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

describe('native equalizer slider scheduling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (SystemAudio.eqSetBandLevel as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
    (SystemAudio.eqSetBandLevel as jest.Mock).mockReturnValue(false);
  });

  test('coalesces bursts and preserves a frame deadline during continuous dragging', () => {
    const scheduler = createNativeEqualizerBandScheduler(() => true);
    const bands = new Array<number>(10).fill(0);
    scheduler.schedule(eqNative, true, bands);
    jest.advanceTimersByTime(8);
    scheduler.schedule(eqNative, true, [1, ...bands.slice(1)]);
    scheduler.schedule(eqNative, true, [2, ...bands.slice(1)]);
    expect(SystemAudio.eqSetBandLevel).not.toHaveBeenCalled();
    jest.advanceTimersByTime(8);
    expect(SystemAudio.eqSetBandLevel).toHaveBeenCalledTimes(2);
    expect(SystemAudio.eqSetBandLevel).toHaveBeenCalledWith(0, 200);
    expect(SystemAudio.eqSetBandLevel).toHaveBeenCalledWith(1, 0);

    scheduler.schedule(eqNative, true, [2, 0, 0, 0, 1, 0, 0, 0, 0, 0]);
    jest.advanceTimersByTime(16);
    expect(SystemAudio.eqSetBandLevel).toHaveBeenCalledTimes(3);
    expect(SystemAudio.eqSetBandLevel).toHaveBeenLastCalledWith(1, 100);
  });

  test('rejects stale sessions and cancels pending writes on disable or release', () => {
    let current = true;
    const scheduler = createNativeEqualizerBandScheduler(() => current);
    const bands = new Array<number>(10).fill(0);
    scheduler.schedule(eqNative, true, bands);
    current = false;
    jest.advanceTimersByTime(16);
    expect(SystemAudio.eqSetBandLevel).not.toHaveBeenCalled();

    current = true;
    scheduler.schedule(eqNative, true, bands);
    scheduler.schedule(eqNative, false, bands);
    jest.advanceTimersByTime(16);
    scheduler.schedule(eqNative, true, bands);
    scheduler.cancel();
    jest.advanceTimersByTime(16);
    expect(SystemAudio.eqSetBandLevel).not.toHaveBeenCalled();
  });

  test('retries unconfirmed writes and resends bands for a new native session', () => {
    const scheduler = createNativeEqualizerBandScheduler(() => true);
    const bands = new Array<number>(10).fill(0);
    (SystemAudio.eqSetBandLevel as jest.Mock).mockReturnValueOnce(false);
    scheduler.schedule(eqNative, true, bands);
    jest.advanceTimersByTime(16);
    scheduler.schedule(eqNative, true, bands);
    jest.advanceTimersByTime(16);
    expect(SystemAudio.eqSetBandLevel).toHaveBeenCalledTimes(3);

    scheduler.schedule({ ...eqNative }, true, bands);
    jest.advanceTimersByTime(16);
    expect(SystemAudio.eqSetBandLevel).toHaveBeenCalledTimes(5);
  });
});
