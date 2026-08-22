describe('shared bounded native read lane', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.resetModules();
    jest.dontMock('expo');
  });

  test('keeps fast metadata behind the same detached-read capacity as audio info and artwork', async () => {
    jest.useFakeTimers();
    jest.resetModules();

    let finishAudioInfo!: (value: null) => void;
    let finishArtwork!: (value: null) => void;
    const extractAudioInfo = jest.fn(() => new Promise<null>(resolve => { finishAudioInfo = resolve; }));
    const extractEmbeddedArtwork = jest.fn(() => new Promise<null>(resolve => { finishArtwork = resolve; }));
    const extractMetadataFast = jest.fn().mockResolvedValue({ title: 'bounded' });

    jest.doMock('expo', () => ({
      NativeModule: class {},
      requireNativeModule: jest.fn((name: string) => {
        if (name === 'ExpoSystemAudio') return {
          eqInit: jest.fn(),
          eqSetEnabled: jest.fn(),
          eqSetBandLevel: jest.fn(),
          eqRelease: jest.fn(),
          extractPalette: jest.fn(),
          extractAudioInfo,
          extractEmbeddedArtwork,
          extractMetadataFast,
        };
        throw new Error('missing optional module');
      }),
    }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SystemAudio } = require('../index') as typeof import('../index');

    const audioInfo = SystemAudio.extractAudioInfo('content://song-1');
    const artwork = SystemAudio.extractEmbeddedArtwork('content://song-2');
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(20_000);
    await expect(audioInfo).resolves.toBeNull();
    await expect(artwork).resolves.toBeNull();

    await expect(SystemAudio.extractMetadataFast('content://song-3')).resolves.toBeNull();
    expect(extractMetadataFast).not.toHaveBeenCalled();

    finishAudioInfo(null);
    await jest.advanceTimersByTimeAsync(0);
    await expect(SystemAudio.extractMetadataFast('content://song-4')).resolves.toEqual({ title: 'bounded' });
    expect(extractMetadataFast).toHaveBeenCalledTimes(1);

    finishArtwork(null);
    await jest.advanceTimersByTimeAsync(0);
  });

  test('keeps palette extraction on the shared detached-read lane', async () => {
    jest.useFakeTimers();
    jest.resetModules();

    let finishPalette!: (value: null) => void;
    let finishAudioInfo!: (value: null) => void;
    const extractPalette = jest.fn(() => new Promise<null>(resolve => { finishPalette = resolve; }));
    const extractAudioInfo = jest.fn(() => new Promise<null>(resolve => { finishAudioInfo = resolve; }));
    const extractEmbeddedArtwork = jest.fn().mockResolvedValue({ uri: 'file:///bounded.jpg', mimeType: 'image/jpeg' });

    jest.doMock('expo', () => ({
      NativeModule: class {},
      requireNativeModule: jest.fn((name: string) => {
        if (name === 'ExpoSystemAudio') return {
          eqInit: jest.fn(),
          eqSetEnabled: jest.fn(),
          eqSetBandLevel: jest.fn(),
          eqRelease: jest.fn(),
          extractPalette,
          extractAudioInfo,
          extractEmbeddedArtwork,
        };
        throw new Error('missing optional module');
      }),
    }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SystemAudio } = require('../index') as typeof import('../index');

    const palette = SystemAudio.extractPalette('content://cover-1');
    const audioInfo = SystemAudio.extractAudioInfo('content://song-2');
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(20_000);
    await expect(palette).resolves.toBeNull();
    await expect(audioInfo).resolves.toBeNull();

    await expect(SystemAudio.extractEmbeddedArtwork('content://song-3')).resolves.toBeNull();
    expect(extractEmbeddedArtwork).not.toHaveBeenCalled();

    finishPalette(null);
    await jest.advanceTimersByTimeAsync(0);
    await expect(SystemAudio.extractEmbeddedArtwork('content://song-4')).resolves.toEqual({
      uri: 'file:///bounded.jpg',
      mimeType: 'image/jpeg',
    });

    finishAudioInfo(null);
    await jest.advanceTimersByTimeAsync(0);
  });
});
