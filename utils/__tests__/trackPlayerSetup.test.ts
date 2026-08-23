import TrackPlayer from 'react-native-track-player';
import {
  formatTrackPlayerSetupError,
  isTrackPlayerAlreadySetUpError,
  resetTrackPlayerSetupForTests,
  setupTrackPlayer,
  TrackPlayerSetupTimeoutError,
  TRACK_PLAYER_OPTIONS,
} from '../trackPlayerSetup';

describe('trackPlayerSetup helpers', () => {
  beforeEach(() => {
    resetTrackPlayerSetupForTests();
    jest.clearAllMocks();
  });

  test('detects already initialized setup errors', () => {
    expect(isTrackPlayerAlreadySetUpError(new Error('The player has already been initialized'))).toBe(true);
    expect(isTrackPlayerAlreadySetUpError('TrackPlayer is already initialized')).toBe(true);
    expect(isTrackPlayerAlreadySetUpError('already set up')).toBe(true);
  });

  test('does not classify unrelated setup failures as already set up', () => {
    expect(isTrackPlayerAlreadySetUpError(new Error('Audio service unavailable'))).toBe(false);
    expect(isTrackPlayerAlreadySetUpError(undefined)).toBe(false);
  });

  test('formats setup failures safely', () => {
    expect(formatTrackPlayerSetupError(new Error('Audio service unavailable'))).toBe('Audio service unavailable');
    expect(formatTrackPlayerSetupError('native failure')).toBe('native failure');
    expect(formatTrackPlayerSetupError(null)).toBe('Unknown TrackPlayer setup error');
  });

  test('sets up player and applies options', async () => {
    await setupTrackPlayer();

    expect(TrackPlayer.setupPlayer).toHaveBeenCalledWith({ autoHandleInterruptions: true });
    expect(TrackPlayer.updateOptions).toHaveBeenCalledWith(TRACK_PLAYER_OPTIONS);
  });

  test('still applies options when player is already set up', async () => {
    (TrackPlayer.setupPlayer as jest.Mock).mockRejectedValueOnce(new Error('already set up'));

    await setupTrackPlayer();

    expect(TrackPlayer.updateOptions).toHaveBeenCalledWith(TRACK_PLAYER_OPTIONS);
  });

  test('logs and rejects on real setup failures before options are applied', async () => {
    const logger = jest.fn();
    (TrackPlayer.setupPlayer as jest.Mock).mockRejectedValueOnce(new Error('native service unavailable'));

    await expect(setupTrackPlayer(logger)).rejects.toThrow('native service unavailable');

    expect(logger).toHaveBeenCalledWith(
      'TrackPlayer setup failed: native service unavailable',
      expect.any(Error),
    );
    expect(TrackPlayer.updateOptions).not.toHaveBeenCalled();
  });

  test('logs and rejects option update failures', async () => {
    const logger = jest.fn();
    (TrackPlayer.updateOptions as jest.Mock).mockRejectedValueOnce(new Error('bad options'));

    await expect(setupTrackPlayer(logger)).rejects.toThrow('bad options');

    expect(logger).toHaveBeenCalledWith('TrackPlayer options update failed: bad options', expect.any(Error));
  });

  test('times out a hung native setup without applying options', async () => {
    jest.useFakeTimers();
    const logger = jest.fn();
    (TrackPlayer.setupPlayer as jest.Mock).mockImplementationOnce(() => new Promise(() => undefined));

    const setup = setupTrackPlayer(logger, { timeoutMs: 25 });
    jest.advanceTimersByTime(25);

    await expect(setup).rejects.toBeInstanceOf(TrackPlayerSetupTimeoutError);
    expect(TrackPlayer.updateOptions).not.toHaveBeenCalled();
    expect(logger).toHaveBeenCalledWith(
      'TrackPlayer setup timed out after 25 ms',
      expect.any(TrackPlayerSetupTimeoutError),
    );
    jest.useRealTimers();
  });

  test('reuses the unresolved native attempt instead of starting concurrent retries', async () => {
    jest.useFakeTimers();
    let resolveNativeSetup!: () => void;
    (TrackPlayer.setupPlayer as jest.Mock).mockImplementationOnce(() => new Promise<void>(resolve => {
      resolveNativeSetup = resolve;
    }));

    const first = setupTrackPlayer(jest.fn(), { timeoutMs: 25 });
    jest.advanceTimersByTime(25);
    await expect(first).rejects.toBeInstanceOf(TrackPlayerSetupTimeoutError);

    const retry = setupTrackPlayer(jest.fn(), { timeoutMs: 100 });
    expect(TrackPlayer.setupPlayer).toHaveBeenCalledTimes(1);
    resolveNativeSetup();
    await retry;

    expect(TrackPlayer.setupPlayer).toHaveBeenCalledTimes(1);
    expect(TrackPlayer.updateOptions).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
