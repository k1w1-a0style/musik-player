import { verifyTagDeletionState } from '../tagWriteVerification';

const contentSong = {
  id: 'song-verification-lane',
  title: 'Old title',
  artist: 'Artist',
  uri: 'content://documents/song-verification-lane',
  fileInfo: {
    uri: 'content://documents/song-verification-lane',
    extension: 'mp3',
  },
};

const deleteTitleDraft = {
  songId: contentSong.id,
  tags: { title: '' },
};

describe('native tag deletion verification lane', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('does not start a second native verification while a timed-out raw call is still running', async () => {
    jest.useFakeTimers();
    let finishFirst!: (value: boolean) => void;
    const firstVerifier = jest.fn(() => new Promise<boolean>(resolve => { finishFirst = resolve; }));
    const secondVerifier = jest.fn(async () => true);

    const first = verifyTagDeletionState(contentSong, deleteTitleDraft, 'mp3', {
      verifyContentDeletion: firstVerifier,
      timeoutMs: 10,
    });
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(10);
    await expect(first).resolves.toBe(false);

    await expect(verifyTagDeletionState(contentSong, deleteTitleDraft, 'mp3', {
      verifyContentDeletion: secondVerifier,
      timeoutMs: 10,
    })).resolves.toBe(false);
    expect(firstVerifier).toHaveBeenCalledTimes(1);
    expect(secondVerifier).not.toHaveBeenCalled();

    finishFirst(false);
    await Promise.resolve();
    await expect(verifyTagDeletionState(contentSong, deleteTitleDraft, 'mp3', {
      verifyContentDeletion: secondVerifier,
      timeoutMs: 10,
    })).resolves.toBe(true);
    expect(secondVerifier).toHaveBeenCalledTimes(1);
  });
});
