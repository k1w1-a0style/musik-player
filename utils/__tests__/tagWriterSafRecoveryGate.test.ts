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

describe('SAF recovery gate before native reads', () => {
  afterEach(() => {
    jest.dontMock('expo-system-audio');
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('pending recovery blocks reading and rewriting the live document', async () => {
    const recover = jest.fn().mockResolvedValue({
      success: false,
      errorCode: 'RecoveryPending',
      message: 'A transaction still requires recovery.',
      recoveryPending: true,
      pendingCount: 1,
    });
    const read = jest.fn();
    const write = jest.fn();
    const { writeTagsToSafContentUri } = loadWithNative({
      hasNativeTagWriter: true,
      recoverPendingAudioTagTransactions: recover,
      readAudioFileBase64: read,
      writeAudioTags: write,
    });

    const result = await writeTagsToSafContentUri(song, draft);

    expect(result).toMatchObject({
      status: 'writeFailed',
      errorCode: 'RecoveryPending',
      recoveryPending: true,
    });
    expect(recover).toHaveBeenCalledTimes(1);
    expect(recover).toHaveBeenCalledWith('content://provider/tree/song.mp3');
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  test('recovery execution errors fail before native read', async () => {
    const recover = jest.fn().mockRejectedValue(new Error('recovery unavailable'));
    const read = jest.fn();
    const write = jest.fn();
    const { writeTagsToSafContentUri } = loadWithNative({
      hasNativeTagWriter: true,
      recoverPendingAudioTagTransactions: recover,
      readAudioFileBase64: read,
      writeAudioTags: write,
    });

    const result = await writeTagsToSafContentUri(song, draft);

    expect(result).toMatchObject({
      status: 'writeFailed',
      errorCode: 'RecoveryFailed',
    });
    expect(result.errorMessage).toMatch(/before reading/i);
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  test('successful flow always recovers before reading and writing', async () => {
    const order: string[] = [];
    const recover = jest.fn().mockImplementation(async () => {
      order.push('recover');
      return { success: true, recoveryPending: false, pendingCount: 0 };
    });
    const read = jest.fn().mockImplementation(async () => {
      order.push('read');
      return 'AQID';
    });
    const write = jest.fn().mockImplementation(
      async (uri: string, request: { changedFields?: string[] }) => {
        order.push('write');
        return {
          success: true,
          uri,
          changedFields: request.changedFields ?? [],
          failedFields: [],
          verified: true,
        };
      },
    );
    const { writeTagsToSafContentUri } = loadWithNative({
      hasNativeTagWriter: true,
      recoverPendingAudioTagTransactions: recover,
      readAudioFileBase64: read,
      writeAudioTags: write,
    });

    const result = await writeTagsToSafContentUri(song, draft);

    expect(result.status).toBe('written');
    expect(recover).toHaveBeenCalledWith('content://provider/tree/song.mp3');
    expect(order).toEqual(['recover', 'read', 'write']);
  });
});
