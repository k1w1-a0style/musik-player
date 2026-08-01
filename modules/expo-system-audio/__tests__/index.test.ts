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

test('fails closed for legacy native writer without recovery contract', async () => {
  jest.resetModules();
  const legacyWriteAudioTags = jest.fn().mockResolvedValue({
    success: true,
    uri: 'content://song.mp3',
    changedFields: ['title'],
    failedFields: [],
    verified: true,
  });
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
      writeAudioTags: legacyWriteAudioTags,
    })),
  }));

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SystemAudio } = require('../index');

  expect(SystemAudio.hasNativeTagWriter).toBe(false);
  await expect(SystemAudio.writeAudioTags('content://song.mp3', { changedFields: ['title'] })).resolves.toMatchObject({
    success: false,
    errorCode: 'WriteNotImplemented',
    verified: false,
  });
  expect(legacyWriteAudioTags).not.toHaveBeenCalled();
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
      writeAudioTags: jest.fn(),
      verifyAudioTagDeletion: jest.fn().mockResolvedValue(true),
      getAudioTagRecoveryStatus,
      recoverPendingAudioTagTransactions,
    })),
  }));

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SystemAudio } = require('../index');

  expect(SystemAudio.hasNativeTagWriter).toBe(true);
  await expect(SystemAudio.getAudioTagRecoveryStatus()).resolves.toMatchObject({ pendingCount: 1 });
  await expect(SystemAudio.recoverPendingAudioTagTransactions('content://song.mp3')).resolves.toMatchObject({ errorCode: 'RecoveryPending', recoveryPending: true });
  expect(recoverPendingAudioTagTransactions).toHaveBeenCalledWith('content://song.mp3');
});

describe('native tag-write operation identifiers', () => {
  const load = (writeAudioTags: jest.Mock) => {
    jest.resetModules();
    jest.doMock('expo', () => ({
      NativeModule: class {},
      requireNativeModule: jest.fn(() => ({
        writeAudioTags,
        verifyAudioTagDeletion: jest.fn(),
        getAudioTagRecoveryStatus: jest.fn(),
        recoverPendingAudioTagTransactions: jest.fn(),
      })),
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../index').SystemAudio;
  };

  test('generates a valid ID for a legacy request without mutating it', async () => {
    const native = jest.fn(async (uri, request) => ({ success: true, uri, changedFields: [], failedFields: [], verified: true, operationId: request.operationId }));
    const systemAudio = load(native);
    const request = { changedFields: ['title'] };
    const result = await systemAudio.writeAudioTags('content://song', request);
    expect(result.operationId).toMatch(/^[A-Za-z0-9._-]{1,80}$/);
    expect(native.mock.calls[0][1].operationId).toBe(result.operationId);
    expect(request).toEqual({ changedFields: ['title'] });
  });

  test('preserves a valid explicit ID', async () => {
    const native = jest.fn(async (uri, request) => ({ success: true, uri, changedFields: [], failedFields: [], verified: true, operationId: request.operationId }));
    const systemAudio = load(native);
    await expect(systemAudio.writeAudioTags('content://song', { operationId: 'caller.valid-_1' })).resolves.toMatchObject({ operationId: 'caller.valid-_1' });
    expect(native.mock.calls[0][1].operationId).toBe('caller.valid-_1');
  });

  test.each(['', '.', '..', 'bad/id', 'bad\\id', '../tag.1', 'x'.repeat(81)])('rejects invalid explicit ID %j before native invocation', async operationId => {
    const native = jest.fn();
    const systemAudio = load(native);
    await expect(systemAudio.writeAudioTags('content://song', { operationId })).resolves.toMatchObject({ errorCode: 'InvalidTagData', phase: 'FAILED', terminal: true });
    expect(native).not.toHaveBeenCalled();
  });

  test.each(['tag.1', 'tag_1', 'tag-1'])('accepts valid ID %j', async operationId => {
    const native = jest.fn(async (uri, request) => ({ success: true, uri, changedFields: [], failedFields: [], verified: true, operationId: request.operationId }));
    const systemAudio = load(native);
    await expect(systemAudio.writeAudioTags('content://song', { operationId })).resolves.toMatchObject({ success: true, operationId });
    expect(native).toHaveBeenCalledTimes(1);
  });
});


test('binds equalizer initialization to a positive audio session', async () => {
  jest.resetModules();
  const eqInit = jest.fn().mockResolvedValue({ available: true });
  jest.doMock('expo', () => ({
    NativeModule: class {},
    requireNativeModule: jest.fn((name: string) => {
      if (name === 'ExpoSystemAudio') return {
        eqInit,
        eqSetEnabled: jest.fn(),
        eqSetBandLevel: jest.fn(),
        eqRelease: jest.fn(),
        extractPalette: jest.fn(),
        extractEmbeddedArtwork: jest.fn(),
        extractAudioInfo: jest.fn(),
      };
      throw new Error('missing optional module');
    }),
  }));

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SystemAudio } = require('../index');
  await expect(SystemAudio.eqInit(41)).resolves.toEqual({ available: true });
  await expect(SystemAudio.eqInit(0)).resolves.toBeNull();
  expect(eqInit).toHaveBeenCalledTimes(1);
  expect(eqInit).toHaveBeenCalledWith(41);
});
