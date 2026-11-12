describe('independent bounded native read lanes', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.resetModules();
    jest.dontMock('expo');
  });

  test('keeps fast metadata behind the same detached-read capacity as audio info', async () => {
    jest.useFakeTimers();
    jest.resetModules();

    const finishAudioInfo: Array<(value: null) => void> = [];
    const extractAudioInfo = jest.fn(() => new Promise<null>(resolve => { finishAudioInfo.push(resolve); }));
    const extractEmbeddedArtwork = jest.fn().mockResolvedValue(null);
    const extractMetadataFast = jest.fn().mockResolvedValue({ title: 'bounded' });
    const readImportFileStat = jest.fn().mockResolvedValue({ size: 100, modificationTime: 200 });

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
          readImportFileStat,
        };
        throw new Error('missing optional module');
      }),
    }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SystemAudio } = require('../index') as typeof import('../index');

    const audioInfo = SystemAudio.extractAudioInfo('content://song-1');
    const artwork = SystemAudio.extractAudioInfo('content://song-2');
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(20_000);
    await expect(audioInfo).resolves.toBeNull();
    await expect(artwork).resolves.toBeNull();

    await expect(SystemAudio.extractMetadataFast('content://song-3')).resolves.toBeNull();
    expect(extractMetadataFast).not.toHaveBeenCalled();
    await expect(SystemAudio.readImportFileStat('content://song-3')).resolves.toEqual({ size: 100, modificationTime: 200 });
    expect(readImportFileStat).toHaveBeenCalledTimes(1);

    finishAudioInfo[0](null);
    await jest.advanceTimersByTimeAsync(0);
    await expect(SystemAudio.extractMetadataFast('content://song-4')).resolves.toEqual({ title: 'bounded' });
    expect(extractMetadataFast).toHaveBeenCalledTimes(1);
    await expect(SystemAudio.readImportFileStat('content://song-4')).resolves.toEqual({ size: 100, modificationTime: 200 });

    finishAudioInfo[1](null);
    await jest.advanceTimersByTimeAsync(0);
  });

  test('a detached palette never consumes the media inspection lane', async () => {
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

    await expect(SystemAudio.extractEmbeddedArtwork('content://song-3')).resolves.toEqual({
      uri: 'file:///bounded.jpg', mimeType: 'image/jpeg',
    });
    expect(extractEmbeddedArtwork).toHaveBeenCalledTimes(1);

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
