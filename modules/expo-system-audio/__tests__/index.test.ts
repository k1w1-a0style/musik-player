describe('expo-system-audio wrapper', () => {
  test('extractAudioInfo returns null when native module is unavailable', async () => {
    jest.resetModules();
    jest.doMock('expo', () => ({
      NativeModule: class {},
      requireNativeModule: jest.fn(() => { throw new Error('missing native module'); }),
    }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SystemAudio } = require('../index');

    await expect(SystemAudio.extractAudioInfo('content://song.mp3')).resolves.toBeNull();
    await expect(SystemAudio.writeAudioTags('content://song.mp3', { changedFields: ['title'] })).resolves.toMatchObject({
      success: false,
      errorCode: 'WriteNotImplemented',
      verified: false,
    });
    expect(SystemAudio.isAvailable).toBe(false);
  });
});


test('hasNativeTagWriter is false for old native module without SAF methods', () => {
  jest.resetModules();
  jest.doMock('expo', () => ({
    NativeModule: class {},
    requireNativeModule: jest.fn(() => ({
      eqInit: jest.fn(),
      eqSetEnabled: jest.fn(),
      eqSetBandLevel: jest.fn(),
      eqRelease: jest.fn(),
      extractPalette: jest.fn(),
      extractEmbeddedArtwork: jest.fn(),
      extractAudioInfo: jest.fn(),
    })),
  }));

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SystemAudio } = require('../index');

  expect(SystemAudio.isAvailable).toBe(true);
  expect(SystemAudio.hasNativeTagWriter).toBe(false);
});
