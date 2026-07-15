import SystemAudio from 'expo-system-audio';
import type { Song } from '../../types/Song';
import { writeTagsToSafContentUri } from '../tagWriterSaf';

const mockRecover = jest.fn();
const mockRead = jest.fn();
const mockWrite = jest.fn();

jest.mock('expo-system-audio', () => {
  const mock = {
    hasNativeTagWriter: true,
    recoverPendingAudioTagTransactions: mockRecover,
    readAudioFileBase64: mockRead,
    writeAudioTags: mockWrite,
  };
  return {
    __esModule: true,
    default: mock,
    SystemAudio: mock,
  };
});

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

describe('SAF recovery gate before native reads', () => {
  beforeEach(() => {
    mockRecover.mockReset();
    mockRead.mockReset();
    mockWrite.mockReset();
    (SystemAudio as { hasNativeTagWriter: boolean }).hasNativeTagWriter = true;
  });

  test('pending recovery blocks reading and rewriting the live document', async () => {
    mockRecover.mockResolvedValue({
      success: false,
      errorCode: 'RecoveryPending',
      message: 'A transaction still requires recovery.',
      recoveryPending: true,
      pendingCount: 1,
    });

    const result = await writeTagsToSafContentUri(song, draft);

    expect(result).toMatchObject({
      status: 'writeFailed',
      errorCode: 'RecoveryPending',
      recoveryPending: true,
    });
    expect(mockRecover).toHaveBeenCalledTimes(1);
    expect(mockRead).not.toHaveBeenCalled();
    expect(mockWrite).not.toHaveBeenCalled();
  });

  test('recovery execution errors fail before native read', async () => {
    mockRecover.mockRejectedValue(new Error('recovery unavailable'));

    const result = await writeTagsToSafContentUri(song, draft);

    expect(result).toMatchObject({
      status: 'writeFailed',
      errorCode: 'RecoveryFailed',
    });
    expect(result.errorMessage).toMatch(/before reading/i);
    expect(mockRead).not.toHaveBeenCalled();
    expect(mockWrite).not.toHaveBeenCalled();
  });

  test('successful flow always recovers before reading and writing', async () => {
    const order: string[] = [];
    mockRecover.mockImplementation(async () => {
      order.push('recover');
      return { success: true, recoveryPending: false, pendingCount: 0 };
    });
    mockRead.mockImplementation(async () => {
      order.push('read');
      return 'AQID';
    });
    mockWrite.mockImplementation(async (uri: string, request: { changedFields?: string[] }) => {
      order.push('write');
      return {
        success: true,
        uri,
        changedFields: request.changedFields ?? [],
        failedFields: [],
        verified: true,
      };
    });

    const result = await writeTagsToSafContentUri(song, draft);

    expect(result.status).toBe('written');
    expect(order).toEqual(['recover', 'read', 'write']);
  });
});
