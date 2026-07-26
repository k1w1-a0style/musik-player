import { resetPlaybackUiActionsForTests, runPlaybackUiAction } from '../playbackUiActions';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(res => {
    resolve = res;
  });
  return { promise, resolve };
};

describe('runPlaybackUiAction', () => {
  beforeEach(() => {
    resetPlaybackUiActionsForTests();
    jest.restoreAllMocks();
  });

  test('consumes rejected UI action promises and reports context', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(runPlaybackUiAction('next', async () => {
      throw new Error('native failed');
    })).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith('[PlaybackUI:next] Action failed.', expect.any(Error));
  });

  test('drops duplicate pending actions when requested', async () => {
    const started = deferred();
    const release = deferred();
    const action = jest.fn(async () => {
      started.resolve();
      await release.promise;
    });

    const first = runPlaybackUiAction('toggle', action, { dropIfPending: true });
    await started.promise;
    const duplicate = runPlaybackUiAction('toggle', action, { dropIfPending: true });
    await expect(duplicate).resolves.toBeUndefined();
    expect(action).toHaveBeenCalledTimes(1);

    release.resolve();
    await expect(first).resolves.toBeUndefined();
    action.mockResolvedValueOnce(undefined);
    await expect(runPlaybackUiAction('toggle', action, { dropIfPending: true })).resolves.toBeUndefined();
    expect(action).toHaveBeenCalledTimes(2);
  });

  test('removes a failed action from the pending set', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const action = jest.fn().mockRejectedValueOnce(new Error('failed')).mockResolvedValueOnce(undefined);

    await expect(runPlaybackUiAction('toggle', action, { dropIfPending: true })).resolves.toBeUndefined();
    await expect(runPlaybackUiAction('toggle', action, { dropIfPending: true })).resolves.toBeUndefined();

    expect(action).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
