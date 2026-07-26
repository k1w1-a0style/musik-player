import { resetPlaybackUiActionsForTests, runPlaybackUiAction } from '../playbackUiActions';

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
    let release!: () => void;
    const action = jest.fn(() => new Promise<void>(resolve => {
      release = resolve;
    }));

    const first = runPlaybackUiAction('toggle', action, { dropIfPending: true });
    const duplicate = runPlaybackUiAction('toggle', action, { dropIfPending: true });
    await duplicate;
    expect(action).toHaveBeenCalledTimes(1);

    release();
    await first;
    await runPlaybackUiAction('toggle', action, { dropIfPending: true });
    expect(action).toHaveBeenCalledTimes(2);
  });
});
