import TrackPlayer from 'react-native-track-player';
import {
  formatTrackPlayerSetupError,
  isTrackPlayerAlreadySetUpError,
  setupTrackPlayer,
  TRACK_PLAYER_OPTIONS,
} from '../trackPlayerSetup';

describe('trackPlayerSetup helpers', () => {
  beforeEach(() => {
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

  test('logs and skips options on real setup failures', async () => {
    const logger = jest.fn();
    (TrackPlayer.setupPlayer as jest.Mock).mockRejectedValueOnce(new Error('native service unavailable'));

    await setupTrackPlayer(logger);

    expect(logger).toHaveBeenCalledWith(
      'TrackPlayer setup failed: native service unavailable',
      expect.any(Error),
    );
    expect(TrackPlayer.updateOptions).not.toHaveBeenCalled();
  });

  test('logs option update failures', async () => {
    const logger = jest.fn();
    (TrackPlayer.updateOptions as jest.Mock).mockRejectedValueOnce(new Error('bad options'));

    await setupTrackPlayer(logger);

    expect(logger).toHaveBeenCalledWith('TrackPlayer options update failed: bad options', expect.any(Error));
  });
});
