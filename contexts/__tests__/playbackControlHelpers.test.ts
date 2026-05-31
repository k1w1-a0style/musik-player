import TrackPlayer, { State } from 'react-native-track-player';
import { resetNativeQueueMutationLockForTests } from '../../utils/nativeQueueMutationLock';
import {
  applyRepeatModeToTrackPlayer,
  applyVolumeToTrackPlayer,
  clampVolume,
  getNextRepeatMode,
  isRepeatMode,
  normalizeRepeatMode,
  normalizeSeekSeconds,
  seekToMillis,
  skipToNextSafely,
  skipToPreviousOrRestart,
  toggleTrackPlayerPlayback,
} from '../playbackControlHelpers';

const trackPlayer = TrackPlayer as typeof TrackPlayer & { __reset: () => void };

describe('playbackControlHelpers', () => {
  beforeEach(() => {
    resetNativeQueueMutationLockForTests();
    trackPlayer.__reset();
    jest.clearAllMocks();
  });

  test('clamps volume values', () => {
    expect(clampVolume(2)).toBe(1);
    expect(clampVolume(-1)).toBe(0);
    expect(clampVolume(Number.NaN)).toBe(1);
    expect(clampVolume(0.4)).toBe(0.4);
  });

  test('detects and normalizes repeat modes', () => {
    expect(isRepeatMode('off')).toBe(true);
    expect(isRepeatMode('all')).toBe(true);
    expect(isRepeatMode('one')).toBe(true);
    expect(isRepeatMode('bad')).toBe(false);
    expect(isRepeatMode(undefined)).toBe(false);
    expect(normalizeRepeatMode('bad')).toBe('off');
    expect(normalizeRepeatMode(undefined)).toBe('off');
  });

  test('cycles repeat modes and treats invalid values as off', () => {
    expect(getNextRepeatMode('off')).toBe('all');
    expect(getNextRepeatMode('all')).toBe('one');
    expect(getNextRepeatMode('one')).toBe('off');
    expect(getNextRepeatMode('bad')).toBe('all');
    expect(getNextRepeatMode(undefined)).toBe('all');
  });

  test('normalizes seek targets from milliseconds to safe seconds', () => {
    expect(normalizeSeekSeconds(5000)).toBe(5);
    expect(normalizeSeekSeconds(0)).toBe(0);
    expect(normalizeSeekSeconds(-100)).toBe(0);
    expect(normalizeSeekSeconds(Number.NaN)).toBe(0);
    expect(normalizeSeekSeconds(Number.POSITIVE_INFINITY)).toBe(0);
  });

  test('applies repeat mode to TrackPlayer', async () => {
    await applyRepeatModeToTrackPlayer('all');

    expect(TrackPlayer.setRepeatMode).toHaveBeenCalledWith(2);
  });

  test('normalizes invalid repeat mode before applying to TrackPlayer', async () => {
    await applyRepeatModeToTrackPlayer('bad');

    expect(TrackPlayer.setRepeatMode).toHaveBeenCalledWith(0);
  });

  test('propagates repeat mode apply rejections', async () => {
    (TrackPlayer.setRepeatMode as jest.Mock).mockRejectedValueOnce(new Error('repeat apply rejected'));

    await expect(applyRepeatModeToTrackPlayer('one')).rejects.toThrow('repeat apply rejected');
  });

  test('applies clamped volume to TrackPlayer', async () => {
    const volume = await applyVolumeToTrackPlayer(2);

    expect(volume).toBe(1);
    expect(TrackPlayer.setVolume).toHaveBeenCalledWith(1);
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

  test('clamps unsafe seek inputs to zero seconds', async () => {
    await seekToMillis(-5000);
    await seekToMillis(Number.NaN);

    expect(TrackPlayer.seekTo).toHaveBeenNthCalledWith(1, 0);
    expect(TrackPlayer.seekTo).toHaveBeenNthCalledWith(2, 0);
  });

  test('skips next safely and swallows queue boundary rejections', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await skipToNextSafely();
    expect(TrackPlayer.skipToNext).toHaveBeenCalledTimes(1);

    (TrackPlayer.skipToNext as jest.Mock).mockRejectedValueOnce(new Error('queue boundary'));
    await expect(skipToNextSafely()).resolves.toBeUndefined();
    expect(TrackPlayer.skipToNext).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith('[Playback] skipToNext failed.', expect.any(Error));
  });

  test('restarts current track when previous is pressed after threshold', async () => {
    jest.spyOn(TrackPlayer, 'getProgress').mockResolvedValueOnce({ position: 4, duration: 10, buffered: 4 });

    await skipToPreviousOrRestart();

    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(0);
    expect(TrackPlayer.skipToPrevious).not.toHaveBeenCalled();
  });

  test('previous falls back to restart at beginning of queue', async () => {
    jest.spyOn(TrackPlayer, 'getProgress').mockResolvedValueOnce({ position: 1, duration: 10, buffered: 1 });
    (TrackPlayer.skipToPrevious as jest.Mock).mockRejectedValueOnce(new Error('queue boundary'));

    await skipToPreviousOrRestart();

    expect(TrackPlayer.skipToPrevious).toHaveBeenCalledTimes(1);
    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(0);
  });
});
