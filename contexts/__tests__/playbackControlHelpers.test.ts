import TrackPlayer, { State } from 'react-native-track-player';
import {
  NativeMutationHydrationStaleError,
  resetNativeQueueMutationLockForTests,
  runExclusiveNativePlaybackControl,
} from '../../utils/nativeQueueMutationLock';
import {
  acquireNativeHydrationGate,
  publishNativeHydrationGate,
  resetNativeHydrationGateForTests,
} from '../../utils/nativeHydrationGate';
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
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
};

const publishReadyGate = () => {
  const owner = acquireNativeHydrationGate();
  publishNativeHydrationGate(owner, 'ready');
};

describe('playbackControlHelpers', () => {
  beforeEach(() => {
    resetNativeQueueMutationLockForTests();
    resetNativeHydrationGateForTests();
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

  test.each([State.Playing, State.Paused])(
    'does not mutate playback when hydration changes during the %s state read',
    async state => {
      publishReadyGate();
      const readStarted = deferred<void>();
      const releaseRead = deferred<{ state: State }>();
      (TrackPlayer.getPlaybackState as jest.Mock).mockImplementationOnce(async () => {
        readStarted.resolve();
        return releaseRead.promise;
      });

      const toggle = toggleTrackPlayerPlayback();
      await readStarted.promise;
      const nextOwner = acquireNativeHydrationGate();
      publishNativeHydrationGate(nextOwner, 'loading');
      releaseRead.resolve({ state });

      await expect(toggle).rejects.toBeInstanceOf(NativeMutationHydrationStaleError);
      expect(TrackPlayer.pause).not.toHaveBeenCalled();
      expect(TrackPlayer.play).not.toHaveBeenCalled();
    },
  );

  test.each([
    [State.Playing, 'pause'],
    [State.Paused, 'play'],
  ] as const)('performs exactly one %s toggle mutation while hydration stays ready', async (state, mutation) => {
    publishReadyGate();
    (TrackPlayer.getPlaybackState as jest.Mock).mockResolvedValueOnce({ state });

    await toggleTrackPlayerPlayback();

    expect(TrackPlayer[mutation]).toHaveBeenCalledTimes(1);
    expect(TrackPlayer[mutation === 'play' ? 'pause' : 'play']).not.toHaveBeenCalled();
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

  test('does not restart when previous becomes hydration-stale before native execution', async () => {
    publishReadyGate();
    (TrackPlayer.getProgress as jest.Mock).mockResolvedValueOnce({ position: 1, duration: 10, buffered: 1 });
    const blockerStarted = deferred<void>();
    const releaseBlocker = deferred<void>();
    const blocker = runExclusiveNativePlaybackControl(async () => {
      blockerStarted.resolve();
      await releaseBlocker.promise;
    });
    await blockerStarted.promise;

    const previous = skipToPreviousOrRestart();
    await Promise.resolve();
    const nextOwner = acquireNativeHydrationGate();
    publishNativeHydrationGate(nextOwner, 'loading');
    releaseBlocker.resolve();

    await blocker;
    await expect(previous).resolves.toBeUndefined();
    expect(TrackPlayer.skipToPrevious).not.toHaveBeenCalled();
    expect(TrackPlayer.seekTo).not.toHaveBeenCalled();
  });

  test.each([State.Paused, State.Stopped])('toggles TrackPlayer playback from %s to play', async state => {
    (TrackPlayer.getPlaybackState as jest.Mock).mockResolvedValueOnce({ state });

    await toggleTrackPlayerPlayback();

    expect(TrackPlayer.play).toHaveBeenCalledTimes(1);
    expect(TrackPlayer.pause).not.toHaveBeenCalled();
  });

  test.each([State.Buffering, State.Loading])('does not treat transient %s state as permanently playing', async state => {
    (TrackPlayer.getPlaybackState as jest.Mock).mockResolvedValueOnce({ state });

    await toggleTrackPlayerPlayback();

    expect(TrackPlayer.play).toHaveBeenCalledTimes(1);
    expect(TrackPlayer.pause).not.toHaveBeenCalled();
  });

  test('previous before or at the restart threshold skips to the previous track', async () => {
    jest.spyOn(TrackPlayer, 'getProgress').mockResolvedValueOnce({ position: 3, duration: 10, buffered: 3 });

    await skipToPreviousOrRestart();

    expect(TrackPlayer.skipToPrevious).toHaveBeenCalledTimes(1);
    expect(TrackPlayer.seekTo).not.toHaveBeenCalled();
  });

  test.each([
    ['off', 0],
    ['all', 2],
    ['one', 1],
  ] as const)('maps repeat mode %s to TrackPlayer repeat mode %s', async (repeatMode, nativeRepeatMode) => {
    await applyRepeatModeToTrackPlayer(repeatMode);

    expect(TrackPlayer.setRepeatMode).toHaveBeenCalledWith(nativeRepeatMode);
  });

  test.each([
    [-100, 0],
    [0, 0],
    [0.75, 0.75],
    [100, 1],
    [Number.POSITIVE_INFINITY, 1],
  ])('applies volume boundary %p as %p', async (volume, expected) => {
    await expect(applyVolumeToTrackPlayer(volume)).resolves.toBe(expected);

    expect(TrackPlayer.setVolume).toHaveBeenCalledWith(expected);
  });

});
