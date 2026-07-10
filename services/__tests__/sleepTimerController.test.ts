import TrackPlayer, { State } from 'react-native-track-player';
import {
  cancelSleepTimer,
  enforceExpiredSleepTimer,
  isSleepTimerActive,
  resetSleepTimerForTests,
  startSleepTimer,
  subscribeToSleepTimer,
} from '../sleepTimerController';
import { resetNativeQueueMutationLockForTests } from '../../utils/nativeQueueMutationLock';

type TrackPlayerTestApi = typeof TrackPlayer & {
  __reset: () => void;
  __setState: (state: State) => void;
};

const trackPlayerTestApi = TrackPlayer as unknown as TrackPlayerTestApi;

describe('sleepTimerController', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    resetNativeQueueMutationLockForTests();
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
    expect(TrackPlayer.pause).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });
});
