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

  test.each([
    ['MissingWritePermission', 'permissionDenied'],
    ['UnsupportedUri', 'unsupportedUri'],
    ['ReplaceFailed', 'writeFailed'],
  ] as const)('maps native %s to terminal failed without overwriting native retryability', async (errorCode, status) => {
    const { writeTagsToSafContentUri } = loadWithNative({
      hasNativeTagWriter: true,
      writeAudioTags: jest.fn(async (uri: string, request: { operationId: string }) => ({
        success: false, uri, changedFields: [], failedFields: ['title'], errorCode,
        verified: false, operationId: request.operationId, phase: 'FAILED', terminal: true, retryable: true,
      })),
    });
    await expect(writeTagsToSafContentUri(song, draft)).resolves.toMatchObject({
      status, operationPhase: 'failed', terminal: true, retryable: true,
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
