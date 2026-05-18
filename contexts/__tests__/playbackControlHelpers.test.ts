import TrackPlayer, { State } from 'react-native-track-player';
import {
  applyRepeatModeToTrackPlayer,
  applyVolumeToTrackPlayer,
  clampVolume,
  getNextRepeatMode,
  seekToMillis,
  skipToNextSafely,
  skipToPreviousOrRestart,
  toggleTrackPlayerPlayback,
} from '../playbackControlHelpers';

describe('playbackControlHelpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('clamps volume values', () => {
    expect(clampVolume(2)).toBe(1);
    expect(clampVolume(-1)).toBe(0);
    expect(clampVolume(Number.NaN)).toBe(1);
    expect(clampVolume(0.4)).toBe(0.4);
  });

  test('cycles repeat modes', () => {
    expect(getNextRepeatMode('off')).toBe('all');
    expect(getNextRepeatMode('all')).toBe('one');
    expect(getNextRepeatMode('one')).toBe('off');
  });

  test('toggles TrackPlayer playback from playing to pause', async () => {
    jest.spyOn(TrackPlayer, 'getPlaybackState').mockResolvedValueOnce({ state: State.Playing });

    await toggleTrackPlayerPlayback();

    expect(TrackPlayer.pause).toHaveBeenCalled();
    expect(TrackPlayer.play).not.toHaveBeenCalled();
  });

  test('toggles TrackPlayer playback from idle to play', async () => {
    jest.spyOn(TrackPlayer, 'getPlaybackState').mockResolvedValueOnce({ state: State.None });

    await toggleTrackPlayerPlayback();

    expect(TrackPlayer.play).toHaveBeenCalled();
  });

  test('seeks using milliseconds input', async () => {
    await seekToMillis(5000);

    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(5);
  });

  test('skips next safely', async () => {
    await skipToNextSafely();

    expect(TrackPlayer.skipToNext).toHaveBeenCalled();
  });

  test('restarts current track when previous is pressed after threshold', async () => {
    jest.spyOn(TrackPlayer, 'getProgress').mockResolvedValueOnce({ position: 4, duration: 10, buffered: 4 });

    await skipToPreviousOrRestart();

    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(0);
    expect(TrackPlayer.skipToPrevious).not.toHaveBeenCalled();
  });

  test('applies repeat mode and volume', async () => {
    await applyRepeatModeToTrackPlayer('all');
    const volume = await applyVolumeToTrackPlayer(2);

    expect(TrackPlayer.setRepeatMode).toHaveBeenCalled();
    expect(volume).toBe(1);
    expect(TrackPlayer.setVolume).toHaveBeenCalledWith(1);
  });
});
