import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer, { Event } from 'react-native-track-player';
import { waitFor } from '@testing-library/react-native';
import { PlaybackService } from '../PlaybackService';
import { resetSleepTimerForTests, startSleepTimer } from '../sleepTimerController';
import { resetNativeQueueMutationLockForTests, runExclusiveNativeQueueReplacement } from '../../utils/nativeQueueMutationLock';
import { acquireNativeHydrationGate, publishNativeHydrationGate, resetNativeHydrationGateForTests } from '../../utils/nativeHydrationGate';

type TrackPlayerTestApi = typeof TrackPlayer & {
  __reset: () => void;
  __trigger: (event: string, payload?: unknown) => void;
  __getListeners: (event: string) => unknown[];
};

const trackPlayerTestApi = TrackPlayer as unknown as TrackPlayerTestApi;

describe('PlaybackService', () => {
  beforeEach(() => {
    resetNativeQueueMutationLockForTests();
    resetNativeHydrationGateForTests();
    publishNativeHydrationGate(acquireNativeHydrationGate(), 'ready');
    trackPlayerTestApi.__reset();
    resetSleepTimerForTests();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  test('registers remote playback controls without waiting for a hanging sleep timer restore', async () => {
    (AsyncStorage.getItem as jest.Mock).mockReturnValueOnce(new Promise<string | null>(() => undefined));

    await PlaybackService();

    expect(trackPlayerTestApi.__getListeners(Event.RemotePlay)).toHaveLength(1);
    expect(trackPlayerTestApi.__getListeners(Event.RemotePause)).toHaveLength(1);
  });

  test('registers remote playback controls', async () => {
    await PlaybackService();

    expect(TrackPlayer.addEventListener).toHaveBeenCalledWith(Event.RemotePlay, expect.any(Function));
    expect(TrackPlayer.addEventListener).toHaveBeenCalledWith(Event.RemotePause, expect.any(Function));
    expect(TrackPlayer.addEventListener).toHaveBeenCalledWith(Event.RemoteStop, expect.any(Function));
    expect(TrackPlayer.addEventListener).toHaveBeenCalledWith(Event.RemoteNext, expect.any(Function));
    expect(TrackPlayer.addEventListener).toHaveBeenCalledWith(Event.RemotePrevious, expect.any(Function));
    expect(TrackPlayer.addEventListener).toHaveBeenCalledWith(Event.RemoteSeek, expect.any(Function));
    expect(TrackPlayer.addEventListener).toHaveBeenCalledWith(Event.RemoteJumpForward, expect.any(Function));
    expect(TrackPlayer.addEventListener).toHaveBeenCalledWith(Event.RemoteJumpBackward, expect.any(Function));
    expect(TrackPlayer.addEventListener).toHaveBeenCalledWith(Event.PlaybackProgressUpdated, expect.any(Function));
    expect(trackPlayerTestApi.__getListeners(Event.RemotePlay)).toHaveLength(1);
    expect(trackPlayerTestApi.__getListeners(Event.RemotePause)).toHaveLength(1);
    expect(trackPlayerTestApi.__getListeners(Event.RemoteStop)).toHaveLength(1);
    expect(trackPlayerTestApi.__getListeners(Event.RemoteNext)).toHaveLength(1);
    expect(trackPlayerTestApi.__getListeners(Event.RemotePrevious)).toHaveLength(1);
    expect(trackPlayerTestApi.__getListeners(Event.RemoteSeek)).toHaveLength(1);
    expect(trackPlayerTestApi.__getListeners(Event.RemoteJumpForward)).toHaveLength(1);
    expect(trackPlayerTestApi.__getListeners(Event.RemoteJumpBackward)).toHaveLength(1);
    expect(trackPlayerTestApi.__getListeners(Event.PlaybackProgressUpdated)).toHaveLength(1);
  });

  test.each([
    ['loading', Event.RemotePrevious, TrackPlayer.skipToPrevious, undefined],
    ['degraded', Event.RemoteNext, TrackPlayer.skipToNext, undefined],
    ['retry-required', Event.RemoteSeek, TrackPlayer.seekTo, { position: 12 }],
    ['degraded', Event.RemotePlay, TrackPlayer.play, undefined],
    ['degraded', Event.RemotePause, TrackPlayer.pause, undefined],
    ['degraded', Event.RemoteStop, TrackPlayer.stop, undefined],
    ['degraded', Event.RemoteJumpForward, TrackPlayer.seekBy, { interval: 5 }],
    ['degraded', Event.RemoteJumpBackward, TrackPlayer.seekBy, { interval: 5 }],
  ] as const)('blocks %s remote action %s without native calls', async (status, event, nativeAction, payload) => {
    const owner = acquireNativeHydrationGate();
    publishNativeHydrationGate(owner, status);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await PlaybackService();
    trackPlayerTestApi.__trigger(event, payload);
    await waitFor(() => expect(warn).toHaveBeenCalledWith('[PlaybackService] Remote action blocked',
      expect.objectContaining({ gateStatus: status })));
    expect(nativeAction).not.toHaveBeenCalled();
  });

  test('runs remote play action', async () => {
    await PlaybackService();

    trackPlayerTestApi.__trigger(Event.RemotePlay);

    await waitFor(() => expect(TrackPlayer.play).toHaveBeenCalledTimes(1));
  });

  test.each([12.5, 0])('seeks when remote seek position %p is valid', async position => {
    await PlaybackService();

    trackPlayerTestApi.__trigger(Event.RemoteSeek, { position });

    await waitFor(() => expect(TrackPlayer.seekTo).toHaveBeenCalledWith(position));
  });

  test.each([
    ['negative', -1],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['non-number', '10'],
  ])('ignores invalid remote seek position: %s', async (_label, position) => {
    await PlaybackService();

    trackPlayerTestApi.__trigger(Event.RemoteSeek, { position });
    await Promise.resolve();

    expect(TrackPlayer.seekTo).not.toHaveBeenCalled();
  });

  test('serializes remote stop behind the native playback lock', async () => {
    let releasePlay!: () => void;
    const playStarted = new Promise<void>(resolve => {
      (TrackPlayer.play as jest.Mock).mockImplementationOnce(async () => {
        resolve();
        await new Promise<void>(release => {
          releasePlay = release;
        });
      });
    });
    await PlaybackService();

    trackPlayerTestApi.__trigger(Event.RemotePlay);
    await playStarted;
    trackPlayerTestApi.__trigger(Event.RemoteStop);
    await Promise.resolve();

    expect(TrackPlayer.stop).not.toHaveBeenCalled();

    releasePlay();

    await waitFor(() => expect(TrackPlayer.stop).toHaveBeenCalledTimes(1));
    expect((TrackPlayer.play as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (TrackPlayer.stop as jest.Mock).mock.invocationCallOrder[0],
    );
  });

  test('rechecks hydration gate inside the lock before a queued remote action', async () => {
    let release!: () => void; let started!: () => void;
    const startedPromise = new Promise<void>(resolve => { started = resolve; });
    const blocker = runExclusiveNativeQueueReplacement(async () => {
      started(); await new Promise<void>(resolve => { release = resolve; });
    });
    await startedPromise;
    await PlaybackService();
    trackPlayerTestApi.__trigger(Event.RemoteNext);
    const owner = acquireNativeHydrationGate();
    publishNativeHydrationGate(owner, 'degraded');
    release(); await blocker;
    await waitFor(() => expect(TrackPlayer.skipToNext).not.toHaveBeenCalled());
  });

  test('logs remote action failures', async () => {
    const error = new Error('not ready');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (TrackPlayer.skipToNext as jest.Mock).mockRejectedValueOnce(error);
    await PlaybackService();

    trackPlayerTestApi.__trigger(Event.RemoteNext);

    await waitFor(() => expect(warn).toHaveBeenCalledWith('[PlaybackService] Remote next failed', error));
  });

  test.each([
    [Event.RemotePause, TrackPlayer.pause, undefined],
    [Event.RemoteStop, TrackPlayer.stop, undefined],
    [Event.RemoteNext, TrackPlayer.skipToNext, undefined],
    [Event.RemotePrevious, TrackPlayer.skipToPrevious, undefined],
  ])('runs remote action for %s', async (event, nativeAction, payload) => {
    (nativeAction as jest.Mock).mockResolvedValueOnce(undefined);
    await PlaybackService();

    trackPlayerTestApi.__trigger(event, payload);

    await waitFor(() => expect(nativeAction).toHaveBeenCalledTimes(1));
  });

  test.each([
    [Event.RemoteJumpForward, 15, 15],
    [Event.RemoteJumpForward, undefined, 10],
    [Event.RemoteJumpForward, Number.NaN, 10],
    [Event.RemoteJumpForward, Number.POSITIVE_INFINITY, 10],
    [Event.RemoteJumpForward, -5, 10],
    [Event.RemoteJumpForward, '15', 10],
    [Event.RemoteJumpBackward, 7, -7],
    [Event.RemoteJumpBackward, undefined, -10],
    [Event.RemoteJumpBackward, Number.NaN, -10],
    [Event.RemoteJumpBackward, Number.POSITIVE_INFINITY, -10],
    [Event.RemoteJumpBackward, -5, -10],
  ])('runs jump seekBy for %s with interval %p', async (event, interval, expectedOffset) => {
    await PlaybackService();

    trackPlayerTestApi.__trigger(event, { interval });

    await waitFor(() => expect(TrackPlayer.seekBy).toHaveBeenCalledWith(expectedOffset));
  });


  test('pauses expired sleep timers from playback progress events', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    await TrackPlayer.play();
    jest.clearAllMocks();
    startSleepTimer(15);
    await PlaybackService();

    jest.setSystemTime(new Date('2026-01-01T00:15:01.000Z'));
    trackPlayerTestApi.__trigger(Event.PlaybackProgressUpdated);

    await waitFor(() => expect(TrackPlayer.pause).toHaveBeenCalledTimes(1));
    jest.useRealTimers();
  });

  test('does not play when an expired sleep timer finds playback already paused', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    await TrackPlayer.pause();
    jest.clearAllMocks();
    startSleepTimer(15);
    await PlaybackService();

    jest.setSystemTime(new Date('2026-01-01T00:15:01.000Z'));
    trackPlayerTestApi.__trigger(Event.PlaybackProgressUpdated);
    await Promise.resolve();

    expect(TrackPlayer.play).not.toHaveBeenCalled();
    expect(TrackPlayer.pause).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  test('keeps the service alive after a remote handler rejection', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (TrackPlayer.pause as jest.Mock).mockRejectedValueOnce(new Error('pause failed'));
    await PlaybackService();

    trackPlayerTestApi.__trigger(Event.RemotePause);
    await waitFor(() => expect(warn).toHaveBeenCalledWith('[PlaybackService] Remote pause failed', expect.any(Error)));

    trackPlayerTestApi.__trigger(Event.RemotePlay);
    await waitFor(() => expect(TrackPlayer.play).toHaveBeenCalledTimes(1));
  });

});
