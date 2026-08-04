import { act, renderHook } from '@testing-library/react-native';
import type { Song } from '../../types/Song';
import type { TagEditDraft } from '../../types/TagEdit';
import { writeTagsToFile } from '../../utils/tagWriter';
import { useTagEditorSaveFlow } from '../useTagEditorSaveFlow';

jest.mock('../../utils/tagWriter', () => ({
  TagWriterError: class MockTagWriterError extends Error {},
  writeTagsToFile: jest.fn(),
}));

jest.mock('../../utils/songMetadataRefresh', () => ({
  refreshSongsFromId3: jest.fn(),
}));

jest.mock('../../utils/tagWriteVerification', () => ({
  shouldVerifyTagDeletionResult: jest.fn(() => false),
  verifyTagDeletionState: jest.fn(),
}));

const mockedWriteTagsToFile = writeTagsToFile as jest.MockedFunction<typeof writeTagsToFile>;

const song: Song = {
  id: 'song-timeout',
  title: 'Title',
  artist: 'Artist',
  uri: 'content://documents/slow.mp3',
  fileInfo: {
    uri: 'content://documents/slow.mp3',
    extension: 'mp3',
    source: 'saf',
  },
};

const draft: TagEditDraft = {
  songId: song.id,
  tags: { title: 'Updated' },
};

describe('useTagEditorSaveFlow timeout handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('releases the UI while the durable native operation remains pending', async () => {
    mockedWriteTagsToFile.mockResolvedValue({
      status: 'writeFailed',
      sourceUri: song.uri,
      warnings: [],
      errorCode: 'RecoveryPending',
      operationId: 'operation-slow',
      operationPhase: 'pendingNativeResult',
      terminal: false,
      retryable: false,
      operationStatus: 'pending',
    });
    const setSaving = jest.fn();
    const setStatus = jest.fn();
    const token = { generation: 1, songId: song.id };
    const { result } = renderHook(() => useTagEditorSaveFlow({
      song,
      draft,
      form: {
        title: 'Updated', artist: 'Artist', albumArtist: '', album: '', year: '',
        genre: '', trackNumber: '', discNumber: '', comment: '',
      },
      container: 'mp3',
      beginSaveFlow: jest.fn(() => token),
      isSaveFlowStale: jest.fn(() => false),
      updateSongMetadata: jest.fn(),
      setSaving,
      setStatus,
      resetAfterWrittenSave: jest.fn(),
      resetAfterNoopSave: jest.fn(),
    }));

    await act(async () => { await result.current(); });

    expect(mockedWriteTagsToFile).toHaveBeenCalledWith(song, draft);
    expect(setStatus).toHaveBeenCalledWith(expect.stringMatching(/läuft weiter/i));
    expect(setSaving).toHaveBeenNthCalledWith(1, true);
    expect(setSaving).toHaveBeenLastCalledWith(false);
  });
});
