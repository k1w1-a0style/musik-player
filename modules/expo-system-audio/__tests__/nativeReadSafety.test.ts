describe('native read safety boundary', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.resetModules();
    jest.dontMock('expo');
  });

  test('returns after the safety deadline when audio info never settles', async () => {
    jest.useFakeTimers();
    const extractAudioInfo = jest.fn(() => new Promise(() => undefined));
    jest.doMock('expo', () => ({
      NativeModule: class {},
      requireNativeModule: jest.fn((name: string) => {
        if (name === 'ExpoSystemAudio') return {
          extractAudioInfo,
          extractEmbeddedArtwork: jest.fn(),
        };
        throw new Error('waveform unavailable');
      }),
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SystemAudio } = require('../index') as typeof import('../index');

    const pending = SystemAudio.extractAudioInfo('content://slow.mp3');
    await jest.advanceTimersByTimeAsync(20_000);

    await expect(pending).resolves.toBeNull();
    expect(extractAudioInfo).toHaveBeenCalledTimes(1);
  });

  test('caps detached native reads and skips further work while both slots are occupied', async () => {
    jest.useFakeTimers();
    const extractAudioInfo = jest.fn(() => new Promise(() => undefined));
    jest.doMock('expo', () => ({
      NativeModule: class {},
      requireNativeModule: jest.fn((name: string) => {
        if (name === 'ExpoSystemAudio') return {
          extractAudioInfo,
          extractEmbeddedArtwork: jest.fn(),
        };
        throw new Error('waveform unavailable');
      }),
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SystemAudio } = require('../index') as typeof import('../index');

    const first = SystemAudio.extractAudioInfo('content://a.mp3');
    const second = SystemAudio.extractAudioInfo('content://b.mp3');
    await jest.advanceTimersByTimeAsync(20_000);
    await expect(Promise.all([first, second])).resolves.toEqual([null, null]);

    await expect(SystemAudio.extractAudioInfo('content://c.mp3')).resolves.toBeNull();
    await expect(SystemAudio.extractEmbeddedArtwork('content://c.mp3')).resolves.toBeNull();
    expect(extractAudioInfo).toHaveBeenCalledTimes(2);
  });

  test('preserves native failures that settle before the deadline', async () => {
    const nativeError = new Error('provider failed');
    const extractEmbeddedArtwork = jest.fn().mockRejectedValue(nativeError);
    jest.doMock('expo', () => ({
      NativeModule: class {},
      requireNativeModule: jest.fn((name: string) => {
        if (name === 'ExpoSystemAudio') return {
          extractAudioInfo: jest.fn(),
          extractEmbeddedArtwork,
        };
        throw new Error('waveform unavailable');
      }),
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SystemAudio } = require('../index') as typeof import('../index');

    await expect(SystemAudio.extractEmbeddedArtwork('content://broken.mp3')).rejects.toBe(nativeError);
  });
});
