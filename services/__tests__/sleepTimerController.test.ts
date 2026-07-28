import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer, { State } from 'react-native-track-player';
import { waitFor } from '@testing-library/react-native';
import {
  cancelSleepTimer,
  enforceExpiredSleepTimer,
  getSleepTimerDeadlineMs,
  isSleepTimerActive,
  resetSleepTimerForTests,
  restorePersistedSleepTimer,
  startSleepTimer,
  subscribeToSleepTimer,
} from '../sleepTimerController';
import {
  resetNativeQueueMutationLockForTests,
  runExclusiveNativeQueueReplacement,
} from '../../utils/nativeQueueMutationLock';
import { acquireNativeHydrationGate, publishNativeHydrationGate, resetNativeHydrationGateForTests } from '../../utils/nativeHydrationGate';

type TrackPlayerTestApi = typeof TrackPlayer & {
  __reset: () => void;
  __setState: (state: State) => void;
};

const trackPlayerTestApi = TrackPlayer as unknown as TrackPlayerTestApi;

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
};

describe('sleepTimerController', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    resetNativeQueueMutationLockForTests();
    resetNativeHydrationGateForTests();
    trackPlayerTestApi.__reset();
    resetSleepTimerForTests();
    jest.clearAllMocks();
  });

  afterEach(() => {
    resetSleepTimerForTests();
    jest.useRealTimers();
  });

  test.each([State.Playing, State.Loading, State.Buffering])(
    'explicitly pauses expired sleep timers when playback state is %s',
    async state => {
      trackPlayerTestApi.__setState(state);
      startSleepTimer(15);

      jest.setSystemTime(new Date('2026-01-01T00:15:01.000Z'));
      await expect(enforceExpiredSleepTimer()).resolves.toBe(true);

      expect(TrackPlayer.pause).toHaveBeenCalledTimes(1);
      expect(TrackPlayer.play).not.toHaveBeenCalled();
      expect(isSleepTimerActive()).toBe(false);
    },
  );

  test.each(['degraded', 'retry-required'] as const)('expiry remains a safety action while user gate is %s', async status => {
    publishNativeHydrationGate(acquireNativeHydrationGate(), status);
    trackPlayerTestApi.__setState(State.Playing);
    startSleepTimer(15);
    jest.setSystemTime(new Date('2026-01-01T00:15:01.000Z'));
    await expect(enforceExpiredSleepTimer()).resolves.toBe(true);
    expect(TrackPlayer.pause).toHaveBeenCalledTimes(1);
    expect(isSleepTimerActive()).toBe(false);
  });

  test.each([State.Paused, State.Stopped, State.Ready, State.None, State.Ended])(
    'clears expired sleep timers without native playback changes when playback state is %s',
    async state => {
      trackPlayerTestApi.__setState(state);
      startSleepTimer(15);

      jest.setSystemTime(new Date('2026-01-01T00:15:01.000Z'));
      await expect(enforceExpiredSleepTimer()).resolves.toBe(true);

      expect(TrackPlayer.pause).not.toHaveBeenCalled();
      expect(TrackPlayer.play).not.toHaveBeenCalled();
      expect(isSleepTimerActive()).toBe(false);
    },
  );

  test('reads final playback state only after an active queue rebuild completes', async () => {
    const rebuildStarted = createDeferred<void>();
    const releaseRebuild = createDeferred<void>();
    const rebuild = runExclusiveNativeQueueReplacement(async () => {
      trackPlayerTestApi.__setState(State.None);
      rebuildStarted.resolve();
      await releaseRebuild.promise;
      trackPlayerTestApi.__setState(State.Playing);
    });
    await rebuildStarted.promise;
    startSleepTimer(15);
    jest.setSystemTime(new Date('2026-01-01T00:15:01.000Z'));

    const expiry = enforceExpiredSleepTimer();
    expect(TrackPlayer.getPlaybackState).not.toHaveBeenCalled();
    expect(isSleepTimerActive()).toBe(true);

    releaseRebuild.resolve();
    await rebuild;
    await expect(expiry).resolves.toBe(true);
    expect(TrackPlayer.getPlaybackState).toHaveBeenCalledTimes(1);
    expect(TrackPlayer.pause).toHaveBeenCalledTimes(1);
    expect(isSleepTimerActive()).toBe(false);
  });

  test('keeps the expired deadline active and retries when pause fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    trackPlayerTestApi.__setState(State.Playing);
    (TrackPlayer.pause as jest.Mock).mockRejectedValueOnce(new Error('pause failed'));
    startSleepTimer(15);

    jest.setSystemTime(new Date('2026-01-01T00:15:01.000Z'));
    await expect(enforceExpiredSleepTimer()).rejects.toThrow('pause failed');

    expect(isSleepTimerActive()).toBe(true);

    await jest.advanceTimersByTimeAsync(1000);

    expect(TrackPlayer.pause).toHaveBeenCalledTimes(2);
    expect(TrackPlayer.play).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(isSleepTimerActive()).toBe(false);
  });

  test('timeout expiry logs failures and leaves the deadline retryable', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    trackPlayerTestApi.__setState(State.Playing);
    (TrackPlayer.pause as jest.Mock).mockRejectedValueOnce(new Error('pause failed'));
    startSleepTimer(15);

    await jest.advanceTimersByTimeAsync(15 * 60 * 1000);

    expect(warn).toHaveBeenCalledWith('[sleepTimerController] Sleep timer expiry failed', expect.any(Error));
    expect(isSleepTimerActive()).toBe(true);

    await jest.advanceTimersByTimeAsync(1000);

    expect(TrackPlayer.pause).toHaveBeenCalledTimes(2);
    expect(isSleepTimerActive()).toBe(false);
  });

  test('does not pause or clear a replacement timer when expiry becomes stale before native state resolves', async () => {
    const playbackState = createDeferred<{ state: State }>();
    (TrackPlayer.getPlaybackState as jest.Mock).mockReturnValueOnce(playbackState.promise);
    startSleepTimer(15);

    jest.setSystemTime(new Date('2026-01-01T00:15:01.000Z'));
    const expiry = enforceExpiredSleepTimer();
    startSleepTimer(30);
    playbackState.resolve({ state: State.Playing });

    await expect(expiry).resolves.toBe(false);
    expect(TrackPlayer.pause).not.toHaveBeenCalled();
    expect(TrackPlayer.play).not.toHaveBeenCalled();
    expect(isSleepTimerActive()).toBe(true);

    trackPlayerTestApi.__setState(State.Playing);
    jest.setSystemTime(new Date('2026-01-01T00:45:02.000Z'));
    await expect(enforceExpiredSleepTimer()).resolves.toBe(true);
    expect(TrackPlayer.pause).toHaveBeenCalledTimes(1);
    expect(isSleepTimerActive()).toBe(false);
  });

  test('does not pause or notify when expiry is cancelled before native state resolves', async () => {
    const playbackState = createDeferred<{ state: State }>();
    const listener = jest.fn();
    (TrackPlayer.getPlaybackState as jest.Mock).mockReturnValueOnce(playbackState.promise);
    startSleepTimer(15);
    subscribeToSleepTimer(listener);
    listener.mockClear();

    jest.setSystemTime(new Date('2026-01-01T00:15:01.000Z'));
    const expiry = enforceExpiredSleepTimer();
    cancelSleepTimer();
    listener.mockClear();
    playbackState.resolve({ state: State.Playing });

    await expect(expiry).resolves.toBe(false);
    expect(TrackPlayer.pause).not.toHaveBeenCalled();
    expect(TrackPlayer.play).not.toHaveBeenCalled();
    expect(isSleepTimerActive()).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });

  test('does not clear a replacement timer when expiry becomes stale during native pause', async () => {
    const pause = createDeferred<void>();
    (TrackPlayer.pause as jest.Mock).mockReturnValueOnce(pause.promise);
    trackPlayerTestApi.__setState(State.Playing);
    startSleepTimer(15);

    jest.setSystemTime(new Date('2026-01-01T00:15:01.000Z'));
    const expiry = enforceExpiredSleepTimer();
    await waitFor(() => expect(TrackPlayer.pause).toHaveBeenCalledTimes(1));

    startSleepTimer(30);
    pause.resolve();

    await expect(expiry).resolves.toBe(false);
    expect(isSleepTimerActive()).toBe(true);

    jest.setSystemTime(new Date('2026-01-01T00:45:02.000Z'));
    await expect(enforceExpiredSleepTimer()).resolves.toBe(true);
    expect(TrackPlayer.pause).toHaveBeenCalledTimes(2);
    expect(TrackPlayer.play).not.toHaveBeenCalled();
    expect(isSleepTimerActive()).toBe(false);
  });

  test('does not schedule a retry when pause failure belongs to a replaced timer', async () => {
    const pause = createDeferred<void>();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (TrackPlayer.pause as jest.Mock).mockReturnValueOnce(pause.promise);
    trackPlayerTestApi.__setState(State.Playing);
    startSleepTimer(15);

    jest.setSystemTime(new Date('2026-01-01T00:15:01.000Z'));
    const expiry = enforceExpiredSleepTimer();
    await waitFor(() => expect(TrackPlayer.pause).toHaveBeenCalledTimes(1));

    startSleepTimer(30);
    pause.reject(new Error('pause failed'));

    await expect(expiry).resolves.toBe(false);
    await jest.advanceTimersByTimeAsync(1000);

    expect(TrackPlayer.pause).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
    expect(isSleepTimerActive()).toBe(true);

    jest.setSystemTime(new Date('2026-01-01T00:45:02.000Z'));
    await expect(enforceExpiredSleepTimer()).resolves.toBe(true);
    expect(TrackPlayer.pause).toHaveBeenCalledTimes(2);
  });

  test('does not schedule a retry when pause failure belongs to a cancelled timer', async () => {
    const pause = createDeferred<void>();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (TrackPlayer.pause as jest.Mock).mockReturnValueOnce(pause.promise);
    trackPlayerTestApi.__setState(State.Playing);
    startSleepTimer(15);

    jest.setSystemTime(new Date('2026-01-01T00:15:01.000Z'));
    const expiry = enforceExpiredSleepTimer();
    await waitFor(() => expect(TrackPlayer.pause).toHaveBeenCalledTimes(1));

    cancelSleepTimer();
    pause.reject(new Error('pause failed'));

    await expect(expiry).resolves.toBe(false);
    await jest.advanceTimersByTimeAsync(1000);

    expect(TrackPlayer.pause).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
    expect(isSleepTimerActive()).toBe(false);
  });

  test('persists, restores, and schedules an active timer across a JS restart', async () => {
    startSleepTimer(15);
    const deadline = getSleepTimerDeadlineMs();
    await Promise.resolve();
    await Promise.resolve();

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@musikplayer:sleepTimerDeadlineMs',
      String(deadline),
    );

    resetSleepTimerForTests({ preservePersisted: true });
    expect(isSleepTimerActive()).toBe(false);

    await expect(restorePersistedSleepTimer()).resolves.toBe(true);
    expect(getSleepTimerDeadlineMs()).toBe(deadline);

    trackPlayerTestApi.__setState(State.Playing);
    jest.setSystemTime(new Date('2026-01-01T00:15:01.000Z'));
    await jest.runOnlyPendingTimersAsync();

    expect(TrackPlayer.pause).toHaveBeenCalledTimes(1);
    expect(isSleepTimerActive()).toBe(false);
  });

  test('enforces an already expired persisted timer during restore', async () => {
    trackPlayerTestApi.__setState(State.Playing);
    await AsyncStorage.setItem('@musikplayer:sleepTimerDeadlineMs', String(Date.now() - 1));
    resetSleepTimerForTests({ preservePersisted: true });

    await expect(restorePersistedSleepTimer()).resolves.toBe(false);

    expect(TrackPlayer.pause).toHaveBeenCalledTimes(1);
    expect(isSleepTimerActive()).toBe(false);
    await Promise.resolve();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@musikplayer:sleepTimerDeadlineMs');
  });

  test('a late persisted read cannot replace a newly started timer', async () => {
    const persistedRead = createDeferred<string | null>();
    (AsyncStorage.getItem as jest.Mock).mockReturnValueOnce(persistedRead.promise);
    const restore = restorePersistedSleepTimer();

    startSleepTimer(30);
    const newDeadline = getSleepTimerDeadlineMs();
    persistedRead.resolve(String(Date.now() + 5 * 60 * 1000));

    await expect(restore).resolves.toBe(false);
    expect(getSleepTimerDeadlineMs()).toBe(newDeadline);
  });

  test('exposes the deadline after start and replacement', () => {
    startSleepTimer(15);
    expect(getSleepTimerDeadlineMs()).toBe(Date.now() + 15 * 60 * 1000);

    jest.setSystemTime(new Date('2026-01-01T00:01:00.000Z'));
    startSleepTimer(30);

    expect(getSleepTimerDeadlineMs()).toBe(Date.now() + 30 * 60 * 1000);
  });

  test('clears the exposed deadline on cancel', () => {
    startSleepTimer(15);
    cancelSleepTimer();

    expect(getSleepTimerDeadlineMs()).toBeNull();
  });

  test('clears the exposed deadline after expiry', async () => {
    startSleepTimer(15);

    jest.setSystemTime(new Date('2026-01-01T00:15:01.000Z'));
    await expect(enforceExpiredSleepTimer()).resolves.toBe(true);

    expect(getSleepTimerDeadlineMs()).toBeNull();
  });

  test('cancel remains idempotent', () => {
    startSleepTimer(15);

    cancelSleepTimer();
    cancelSleepTimer();

    expect(isSleepTimerActive()).toBe(false);
    expect(TrackPlayer.play).not.toHaveBeenCalled();
  });

  test('resetSleepTimerForTests clears deadline, timeout, and listeners', async () => {
    const listener = jest.fn();
    subscribeToSleepTimer(listener);
    startSleepTimer(15);
    listener.mockClear();

    resetSleepTimerForTests();
    jest.setSystemTime(new Date('2026-01-01T00:15:01.000Z'));
    await jest.runOnlyPendingTimersAsync();
    startSleepTimer(15);

    expect(isSleepTimerActive()).toBe(true);
    expect(getSleepTimerDeadlineMs()).not.toBeNull();
    expect(TrackPlayer.pause).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });
});
