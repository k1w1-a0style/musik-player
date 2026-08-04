import type { AudioTagWriteResult } from '../index';

const successResult = (uri: string): AudioTagWriteResult => ({
  success: true,
  uri,
  changedFields: ['title'],
  failedFields: [],
  verified: true,
});

describe('native tag write capacity boundary', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('expo');
  });

  test('caps concurrent native tag writes and preserves the rejected operation identity', async () => {
    const resolvers: Array<(value: AudioTagWriteResult) => void> = [];
    const writeAudioTags = jest.fn((uri: string) => new Promise<AudioTagWriteResult>(resolve => {
      resolvers.push(value => resolve({ ...value, uri }));
    }));
    jest.doMock('expo', () => ({
      NativeModule: class {},
      requireNativeModule: jest.fn((name: string) => {
        if (name === 'ExpoSystemAudio') return {
          writeAudioTags,
          verifyAudioTagDeletion: jest.fn(),
          getAudioTagRecoveryStatus: jest.fn(),
          recoverPendingAudioTagTransactions: jest.fn(),
          acknowledgeAudioTagRecoveryOutcomes: jest.fn(),
        };
        throw new Error('waveform unavailable');
      }),
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SystemAudio } = require('../index') as typeof import('../index');

    const first = SystemAudio.writeAudioTags('content://one', {
      operationId: 'capacity-one',
      changedFields: ['title'],
    });
    const second = SystemAudio.writeAudioTags('content://two', {
      operationId: 'capacity-two',
      changedFields: ['title'],
    });

    await expect(SystemAudio.writeAudioTags('content://three', {
      operationId: 'capacity-three',
      changedFields: ['title'],
    })).resolves.toEqual(expect.objectContaining({
      success: false,
      errorCode: 'TransactionConflict',
      operationId: 'capacity-three',
      phase: 'FAILED',
      terminal: true,
      retryable: true,
      recoveryPending: false,
      failedFields: ['title'],
    }));
    expect(writeAudioTags).toHaveBeenCalledTimes(2);

    resolvers[0](successResult('content://one'));
    resolvers[1](successResult('content://two'));
    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ success: true, operationId: 'capacity-one' }),
      expect.objectContaining({ success: true, operationId: 'capacity-two' }),
    ]);

    const fourth = SystemAudio.writeAudioTags('content://four', {
      operationId: 'capacity-four',
      changedFields: ['title'],
    });
    expect(writeAudioTags).toHaveBeenCalledTimes(3);
    resolvers[2](successResult('content://four'));
    await expect(fourth).resolves.toEqual(expect.objectContaining({
      success: true,
      operationId: 'capacity-four',
    }));
  });

  test('releases capacity when the native write rejects', async () => {
    const nativeError = new Error('provider failed');
    const writeAudioTags = jest
      .fn()
      .mockRejectedValueOnce(nativeError)
      .mockResolvedValueOnce(successResult('content://after-error'));
    jest.doMock('expo', () => ({
      NativeModule: class {},
      requireNativeModule: jest.fn((name: string) => {
        if (name === 'ExpoSystemAudio') return {
          writeAudioTags,
          verifyAudioTagDeletion: jest.fn(),
          getAudioTagRecoveryStatus: jest.fn(),
          recoverPendingAudioTagTransactions: jest.fn(),
          acknowledgeAudioTagRecoveryOutcomes: jest.fn(),
        };
        throw new Error('waveform unavailable');
      }),
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SystemAudio } = require('../index') as typeof import('../index');

    await expect(SystemAudio.writeAudioTags('content://broken', {
      operationId: 'capacity-error',
      changedFields: ['title'],
    })).rejects.toBe(nativeError);

    await expect(SystemAudio.writeAudioTags('content://after-error', {
      operationId: 'capacity-after-error',
      changedFields: ['title'],
    })).resolves.toEqual(expect.objectContaining({
      success: true,
      operationId: 'capacity-after-error',
    }));
    expect(writeAudioTags).toHaveBeenCalledTimes(2);
  });
});
