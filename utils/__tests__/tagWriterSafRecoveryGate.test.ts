import type { Song } from '../../types/Song';

const song: Song = {
  id: 'song-1',
  title: 'Old title',
  artist: 'Artist',
  uri: 'content://provider/tree/song.mp3',
  fileInfo: {
    uri: 'content://provider/tree/song.mp3',
    extension: 'mp3',
    source: 'saf',
  },
};

const draft = {
  songId: 'song-1',
  tags: { title: 'New title' },
};

const loadWithNative = (native: Record<string, unknown>) => {
  jest.resetModules();
  jest.doMock('expo-system-audio', () => ({
    __esModule: true,
    default: native,
    SystemAudio: native,
  }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../tagWriterSaf') as typeof import('../tagWriterSaf');
};

describe('native streaming SAF write contract', () => {
  afterEach(() => {
    jest.dontMock('expo-system-audio');
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('native recovery-pending result blocks the save without any JS audio read', async () => {
    const write = jest.fn().mockResolvedValue({
      success: false,
      uri: song.uri,
      changedFields: [],
      failedFields: ['title'],
      errorCode: 'RecoveryPending',
      message: 'A transaction still requires recovery.',
      recoveryPending: true,
      verified: false,
    });
    const { writeTagsToSafContentUri } = loadWithNative({
      hasNativeTagWriter: true,
      writeAudioTags: write,
    });

    const result = await writeTagsToSafContentUri(song, draft);

    expect(result).toMatchObject({
      status: 'writeFailed',
      errorCode: 'RecoveryPending',
      recoveryPending: true,
    });
    expect(write).toHaveBeenCalledTimes(1);
  });

  test('same-target busy result is an independent terminal retryable conflict', async () => {
    let finish!: (value: Record<string, unknown>) => void;
    const nativeResult = new Promise<Record<string, unknown>>(resolve => { finish = resolve; });
    const write = jest.fn((_uri: string, _request: { operationId: string }) => nativeResult);
    const { writeTagsToSafContentUri } = loadWithNative({ hasNativeTagWriter: true, writeAudioTags: write });

    const first = writeTagsToSafContentUri(song, draft, { operationId: 'first-operation' });
    await Promise.resolve();
    const busy = await writeTagsToSafContentUri(song, draft, { operationId: 'rejected-operation' });
    expect(busy).toMatchObject({
      errorCode: 'TransactionConflict', operationId: 'rejected-operation', operationPhase: 'failed',
      terminal: true, retryable: true, recoveryPending: false,
    });
    expect(write).toHaveBeenCalledTimes(1);

    finish({
      success: true, uri: song.uri, changedFields: ['title'], failedFields: [], verified: true,
      operationId: 'first-operation', phase: 'COMPLETED', terminal: true, retryable: false,
    });
    await expect(first).resolves.toMatchObject({ status: 'written', operationId: 'first-operation' });
    expect(busy).toMatchObject({ operationId: 'rejected-operation', terminal: true, retryable: true });
  });

  test('native timeout remains pending and is not reported as busy', async () => {
    jest.useFakeTimers();
    const write = jest.fn(() => new Promise(() => undefined));
    const { writeTagsToSafContentUri } = loadWithNative({ hasNativeTagWriter: true, writeAudioTags: write });
    const pendingPromise = writeTagsToSafContentUri(song, draft, { timeoutMs: 10, operationId: 'pending-operation' });
    await Promise.resolve();
    jest.advanceTimersByTime(10);
    await expect(pendingPromise).resolves.toMatchObject({
      errorCode: 'RecoveryPending', operationId: 'pending-operation', operationPhase: 'pendingNativeResult',
      terminal: false, retryable: false, recoveryPending: true,
    });
    jest.useRealTimers();
  });

  test.each([
    ['MissingWritePermission', 'permissionDenied', true],
    ['UnsupportedUri', 'unsupportedUri', false],
    ['ReplaceFailed', 'writeFailed', true],
  ] as const)('maps native %s without overwriting retryable=%s', async (errorCode, status, retryable) => {
    const { writeTagsToSafContentUri } = loadWithNative({
      hasNativeTagWriter: true,
      writeAudioTags: jest.fn(async (uri: string, request: { operationId: string }) => ({
        success: false, uri, changedFields: [], failedFields: ['title'], errorCode,
        verified: false, operationId: request.operationId, phase: 'FAILED', terminal: true, retryable,
      })),
    });
    await expect(writeTagsToSafContentUri(song, draft)).resolves.toMatchObject({
      status, operationPhase: 'failed', terminal: true, retryable,
    });
  });

  test('sends only draft metadata and never a full rewritten audio payload', async () => {
    const write = jest.fn().mockImplementation(async (uri: string, request: Record<string, unknown>) => ({
      success: true,
      uri,
      changedFields: request.changedFields,
      failedFields: [],
      verified: true,
    }));
    const { writeTagsToSafContentUri } = loadWithNative({
      hasNativeTagWriter: true,
      writeAudioTags: write,
    });

    const result = await writeTagsToSafContentUri(song, draft);

    expect(result.status).toBe('written');
    const request = write.mock.calls[0][1];
    expect(request).toMatchObject({
      container: 'mp3',
      tags: { title: 'New title' },
      changedFields: ['title'],
    });
    expect(request).not.toHaveProperty('rewrittenAudioBase64');
    expect(request).not.toHaveProperty('expectedWrittenSha256Hex');
    expect(request).not.toHaveProperty('expectedWrittenSizeBytes');
  });

  test('encodes only the bounded cover payload and maps native no-op', async () => {
    const write = jest.fn().mockResolvedValue({
      success: true,
      uri: song.uri,
      changedFields: ['cover'],
      failedFields: [],
      verified: true,
      noop: true,
    });
    const { writeTagsToSafContentUri } = loadWithNative({
      hasNativeTagWriter: true,
      writeAudioTags: write,
    });
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const result = await writeTagsToSafContentUri(song, {
      songId: song.id,
      tags: {},
      cover: { mimeType: 'image/png', data: png },
    });

    expect(result.status).toBe('noop');
    expect(write.mock.calls[0][1]).toMatchObject({
      cover: { mimeType: 'image/png', dataBase64: 'iVBORw0KGgo=' },
      changedFields: ['cover'],
    });
  });
});
