import type { Song } from '../../types/Song';

const song = (overrides: Partial<Song>): Song => ({
  id: '1',
  title: 'A',
  artist: 'B',
  ...overrides,
});

const loadWithNative = (native: Record<string, unknown>) => {
  jest.doMock('expo-system-audio', () => ({
    __esModule: true,
    default: native,
    SystemAudio: native,
  }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../tagWriter') as typeof import('../tagWriter');
};

describe('tagWriter public content source gate', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.dontMock('expo-system-audio');
  });

  test('blocks an explicitly identified MediaLibrary source before native write', async () => {
    const native = {
      isAvailable: true,
      hasNativeTagWriter: true,
      writeAudioTags: jest.fn(),
    };
    const { writeTagsToFile } = loadWithNative(native);
    const uri = 'content://media/external/audio/media/1';

    const result = await writeTagsToFile(
      song({
        uri,
        fileInfo: { uri, extension: 'mp3', source: 'media-library' },
      }),
      { songId: '1', tags: { title: 'Blocked' } },
    );

    expect(result).toMatchObject({
      status: 'permissionDenied',
      errorCode: 'MissingWritePermission',
      sourceUri: uri,
    });
    expect(native.writeAudioTags).not.toHaveBeenCalled();
  });

  test('allows an explicitly identified SAF source to reach the native writer', async () => {
    const native = {
      isAvailable: true,
      hasNativeTagWriter: true,
      writeAudioTags: jest.fn(async (uri: string, request: { operationId: string }) => ({
        success: true,
        uri,
        changedFields: ['title'],
        failedFields: [],
        verified: true,
        transactionId: 'tx-saf',
        recovered: false,
        recoveryPending: false,
        operationId: request.operationId, phase: 'COMPLETED', terminal: true, retryable: false,
      })),
    };
    const { writeTagsToFile } = loadWithNative(native);
    const uri = 'content://com.android.externalstorage.documents/document/primary%3AMusic%2Fa.mp3';

    const result = await writeTagsToFile(
      song({
        uri,
        fileInfo: { uri, extension: 'mp3', source: 'saf' },
      }),
      { songId: '1', tags: { title: 'Allowed' } },
    );

    expect(result).toMatchObject({ status: 'written', transactionId: 'tx-saf' });
    expect(native.writeAudioTags).toHaveBeenCalledTimes(1);
  });

  test('applies a caller deadline when the native SAF writer never settles', async () => {
    jest.useFakeTimers();
    const native = {
      isAvailable: true,
      hasNativeTagWriter: true,
      writeAudioTags: jest.fn(() => new Promise(() => undefined)),
    };
    const { writeTagsToFile } = loadWithNative(native);
    const uri = 'content://com.android.externalstorage.documents/document/primary%3AMusic%2Fslow.mp3';
    const request = writeTagsToFile(
      song({ uri, fileInfo: { uri, extension: 'mp3', source: 'saf' } }),
      { songId: '1', tags: { title: 'Slow' } },
    );

    for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
    await jest.advanceTimersByTimeAsync(30_000);

    await expect(request).resolves.toMatchObject({
      status: 'writeFailed',
      errorCode: 'RecoveryPending',
      operationPhase: 'pendingNativeResult',
      terminal: false,
      operationStatus: 'pending',
    });
  });

  test('delegates ambiguous content provenance to native permission checks', async () => {
    const native = {
      isAvailable: true,
      hasNativeTagWriter: true,
      writeAudioTags: jest.fn(async (uri: string, request: { operationId: string }) => ({
        success: false,
        uri,
        changedFields: [],
        failedFields: ['title'],
        errorCode: 'MissingWritePermission',
        message: 'No persisted or direct write permission.',
        verified: false,
        operationId: request.operationId, phase: 'FAILED', terminal: true, retryable: true,
      })),
    };
    const { writeTagsToFile } = loadWithNative(native);
    const uri = 'content://unknown.provider/audio/1';

    const result = await writeTagsToFile(
      song({ uri, fileInfo: { uri, extension: 'mp3' } }),
      { songId: '1', tags: { title: 'Native gate' } },
    );

    expect(result).toMatchObject({
      status: 'permissionDenied',
      errorCode: 'MissingWritePermission',
    });
    expect(native.writeAudioTags).toHaveBeenCalledTimes(1);
  });
});
