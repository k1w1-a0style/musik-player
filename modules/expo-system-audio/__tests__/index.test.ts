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
    expect(SystemAudio.isAvailable).toBe(false);
  });
});
