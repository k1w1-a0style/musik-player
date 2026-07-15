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
    await expect(SystemAudio.getAudioTagRecoveryStatus()).resolves.toEqual({ pendingCount: 0, transactions: [] });
    await expect(SystemAudio.recoverPendingAudioTagTransactions()).resolves.toMatchObject({ success: true, recoveryPending: false });
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


test('forwards native recovery APIs when present', async () => {
  jest.resetModules();
  const getAudioTagRecoveryStatus = jest.fn().mockResolvedValue({ pendingCount: 1, transactions: [{ transactionId: 'tx', state: 'RECOVERY_REQUIRED' }] });
  const recoverPendingAudioTagTransactions = jest.fn().mockResolvedValue({ success: false, errorCode: 'RecoveryPending', recoveryPending: true });
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
      readAudioFileBase64: jest.fn(),
      writeAudioTags: jest.fn(),
      getAudioTagRecoveryStatus,
      recoverPendingAudioTagTransactions,
    })),
  }));

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SystemAudio } = require('../index');

  await expect(SystemAudio.getAudioTagRecoveryStatus()).resolves.toMatchObject({ pendingCount: 1 });
  await expect(SystemAudio.recoverPendingAudioTagTransactions()).resolves.toMatchObject({ errorCode: 'RecoveryPending', recoveryPending: true });
});
