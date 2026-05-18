import {
  formatTrackPlayerSetupError,
  isTrackPlayerAlreadySetUpError,
} from '../trackPlayerSetup';

describe('trackPlayerSetup helpers', () => {
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
});
