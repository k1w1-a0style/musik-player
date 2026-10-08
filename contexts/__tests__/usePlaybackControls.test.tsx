import React from 'react';
import { Button, Text } from 'react-native';
import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
import TrackPlayer, { State, usePlayWhenReady } from 'react-native-track-player';
import {
  clampVolume,
  getNextRepeatMode,
  usePlaybackControls,
} from '../usePlaybackControls';
import { resetSeekControllerForTests } from '../../utils/seekController';
import { resetNativeQueueMutationLockForTests } from '../../utils/nativeQueueMutationLock';
import { acknowledgeNativePlaybackRecovery, getNativePlaybackWatchdogSnapshot, NATIVE_PLAYBACK_DEADLINE_MS } from '../../utils/nativePlaybackWatchdog';


const deferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const PlaybackControlsProbe = () => {
  const {
    isPlaying,
    repeatMode,
    cycleRepeatMode,
    volume,
    setVolume,
    togglePlayPause,
    stop,
    seekTo,
    next,
    previous,
  } = usePlaybackControls();

  return (
    <>
      <Text testID="is-playing">{String(isPlaying)}</Text>
      <Text testID="repeat">{repeatMode}</Text>
      <Text testID="volume">{String(volume)}</Text>
      <Button testID="repeat-button" title="repeat" onPress={() => void cycleRepeatMode()} />
      <Button testID="volume-button" title="volume" onPress={() => void setVolume(2)} />
      <Button testID="toggle" title="toggle" onPress={() => void togglePlayPause()} />
      <Button testID="stop" title="stop" onPress={() => void stop()} />
      <Button testID="seek" title="seek" onPress={() => void seekTo(5000)} />
      <Button testID="next" title="next" onPress={() => void next()} />
      <Button testID="previous" title="previous" onPress={() => void previous()} />
    </>
  );
};

describe('usePlaybackControls', () => {
  beforeEach(() => {
    resetNativeQueueMutationLockForTests();
    resetSeekControllerForTests();
    jest.clearAllMocks();
    jest.mocked(usePlayWhenReady).mockReturnValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
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

  test('sets clamped volume', async () => {
    const { getByTestId } = render(<PlaybackControlsProbe />);

    await act(async () => {
      fireEvent.press(getByTestId('volume-button'));
    });

    expect(getByTestId('volume').props.children).toBe('1');
    expect(TrackPlayer.setVolume).toHaveBeenCalledWith(1);
  });

  test('cycles repeat mode and updates TrackPlayer', async () => {
    const { getByTestId } = render(<PlaybackControlsProbe />);

    await act(async () => {
      fireEvent.press(getByTestId('repeat-button'));
    });

    expect(getByTestId('repeat').props.children).toBe('all');
    expect(TrackPlayer.setRepeatMode).toHaveBeenCalled();
  });


  test('serializes volume writes and commits only the latest queued slider value', async () => {
    const firstWrite = deferred<void>();
    const firstWriteStarted = deferred<void>();
    (TrackPlayer.setVolume as jest.Mock)
      .mockImplementationOnce(() => {
        firstWriteStarted.resolve();
        return firstWrite.promise;
      })
      .mockResolvedValue(undefined);
    const hook = renderHook(() => usePlaybackControls());

    let firstRequest!: Promise<void>;
    let middleRequest!: Promise<void>;
    let latestRequest!: Promise<void>;
    await act(async () => {
      firstRequest = hook.result.current.setVolume(0.2);
      await firstWriteStarted.promise;
      middleRequest = hook.result.current.setVolume(0.5);
      latestRequest = hook.result.current.setVolume(0.8);
    });

    expect(hook.result.current.volume).toBe(0.8);
    expect(TrackPlayer.setVolume).toHaveBeenCalledTimes(1);
    expect(TrackPlayer.setVolume).toHaveBeenNthCalledWith(1, 0.2);

    await act(async () => {
      firstWrite.resolve();
      await Promise.all([firstRequest, middleRequest, latestRequest]);
    });

    expect(TrackPlayer.setVolume).toHaveBeenCalledTimes(2);
    expect(TrackPlayer.setVolume).toHaveBeenNthCalledWith(2, 0.8);
    expect(hook.result.current.volume).toBe(0.8);
    hook.unmount();
  });

  test('serializes rapid repeat taps without reusing a stale rendered mode', async () => {
    const firstWrite = deferred<void>();
    (TrackPlayer.setRepeatMode as jest.Mock)
      .mockImplementationOnce(() => firstWrite.promise)
      .mockResolvedValue(undefined);
    const hook = renderHook(() => usePlaybackControls());

    let firstRequest!: Promise<void>;
    let secondRequest!: Promise<void>;
    await act(async () => {
      firstRequest = hook.result.current.cycleRepeatMode();
      await Promise.resolve();
      secondRequest = hook.result.current.cycleRepeatMode();
    });

    expect(TrackPlayer.setRepeatMode).toHaveBeenCalledTimes(1);
    await act(async () => {
      firstWrite.resolve();
      await Promise.all([firstRequest, secondRequest]);
    });

    expect(TrackPlayer.setRepeatMode).toHaveBeenCalledTimes(2);
    expect(hook.result.current.repeatMode).toBe('one');
    hook.unmount();
  });

  test('applies a submitted repeat tap before the following navigation boundary', async () => {
    await TrackPlayer.reset();
    await TrackPlayer.add([{ id: 'a', url: 'file:///a' }, { id: 'b', url: 'file:///b' }]);
    await TrackPlayer.skip(1);
    jest.mocked(TrackPlayer.skip).mockClear();
    const hook = renderHook(() => usePlaybackControls());
    await act(async () => {
      const repeat = hook.result.current.cycleRepeatMode();
      const next = hook.result.current.next();
      await Promise.all([repeat, next]);
    });
    expect(TrackPlayer.skip).toHaveBeenCalledWith(0);
    expect(hook.result.current.repeatMode).toBe('all');
    hook.unmount();
    await TrackPlayer.reset();
  });

  test('rolls back an unconfirmed volume preview at the deadline and ignores late acknowledgement', async () => {
    jest.useFakeTimers();
    const pending = deferred<void>();
    const started = deferred<void>();
    const hook = renderHook(() => usePlaybackControls());
    await act(async () => { await hook.result.current.setVolume(0.4); });
    jest.mocked(TrackPlayer.setVolume).mockImplementationOnce(() => { started.resolve(); return pending.promise; });
    let outcome!: Promise<unknown>;
    await act(async () => {
      outcome = hook.result.current.setVolume(0.8).catch(error => error);
      await started.promise;
    });
    expect(hook.result.current.volume).toBe(0.8);
    await act(async () => { await jest.advanceTimersByTimeAsync(NATIVE_PLAYBACK_DEADLINE_MS); });
    expect(await outcome).toMatchObject({ name: 'NativePlaybackTimeoutError' });
    expect(hook.result.current.volume).toBe(0.4);
    await act(async () => { pending.resolve(); await jest.advanceTimersByTimeAsync(0); });
    expect(hook.result.current.volume).toBe(0.4);
    expect(getNativePlaybackWatchdogSnapshot().status).toBe('retry-required');
    acknowledgeNativePlaybackRecovery();
    jest.mocked(TrackPlayer.setVolume).mockRejectedValueOnce(new Error('new write failed'));
    await act(async () => { await expect(hook.result.current.setVolume(0.7)).rejects.toThrow('new write failed'); });
    expect(hook.result.current.volume).toBe(0.4);
    hook.unmount();
  });

  test('keeps repeat state confirmed after timeout and drains all successful rapid tap intents', async () => {
    jest.useFakeTimers();
    const pending = deferred<void>();
    const started = deferred<void>();
    jest.mocked(TrackPlayer.setRepeatMode).mockImplementationOnce(async mode => {
      started.resolve();
      await pending.promise;
      return mode;
    });
    const hook = renderHook(() => usePlaybackControls());
    let outcome!: Promise<unknown>;
    await act(async () => {
      outcome = hook.result.current.cycleRepeatMode().catch(error => error);
      await started.promise;
    });
    await act(async () => { await jest.advanceTimersByTimeAsync(NATIVE_PLAYBACK_DEADLINE_MS); });
    expect(await outcome).toMatchObject({ name: 'NativePlaybackTimeoutError' });
    expect(hook.result.current.repeatMode).toBe('off');
    await act(async () => { pending.resolve(); await jest.advanceTimersByTimeAsync(0); });
    expect(hook.result.current.repeatMode).toBe('off');
    acknowledgeNativePlaybackRecovery();
    jest.mocked(TrackPlayer.setRepeatMode).mockClear();
    await act(async () => {
      await Promise.all(Array.from({ length: 5 }, () => hook.result.current.cycleRepeatMode()));
    });
    expect(TrackPlayer.setRepeatMode).toHaveBeenCalledTimes(5);
    expect(jest.mocked(TrackPlayer.setRepeatMode).mock.calls.map(([mode]) => mode)).toEqual([2, 1, 0, 2, 1]);
    expect(hook.result.current.repeatMode).toBe('one');
    hook.unmount();
  });

  test('records pause immediately from the visible playing state', async () => {
    (TrackPlayer as unknown as { usePlaybackState: jest.Mock }).usePlaybackState.mockReturnValueOnce({ state: State.Playing });
    const { getByTestId } = render(<PlaybackControlsProbe />);

    await act(async () => {
      fireEvent.press(getByTestId('toggle'));
    });

    expect(TrackPlayer.pause).toHaveBeenCalled();
  });

  test('keeps visible playing intent while seek-pending playback state buffers', async () => {
    jest.useFakeTimers();
    const usePlaybackState = (TrackPlayer as unknown as { usePlaybackState: jest.Mock }).usePlaybackState;
    usePlaybackState.mockReturnValueOnce({ state: State.Playing });
    let resolveSeek: () => void = () => undefined;
    (TrackPlayer.seekTo as jest.Mock).mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveSeek = resolve;
    }));

    const { getByTestId, rerender } = render(<PlaybackControlsProbe />);
    expect(getByTestId('is-playing').props.children).toBe('true');

    await act(async () => {
      fireEvent.press(getByTestId('seek'));
    });

    usePlaybackState.mockReturnValue({ state: State.Buffering });
    rerender(<PlaybackControlsProbe />);

    expect(getByTestId('is-playing').props.children).toBe('true');

    await act(async () => {
      resolveSeek();
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    jest.useRealTimers();
  });

  test.each([State.Buffering, State.Loading, State.Ready])(
    'keeps the pause control through %s after a seek has resolved', async state => {
      jest.useFakeTimers();
      const usePlaybackState = (TrackPlayer as unknown as { usePlaybackState: jest.Mock }).usePlaybackState;
      usePlaybackState.mockReturnValue({ state: State.Playing });
      jest.mocked(usePlayWhenReady).mockReturnValue(true);
      const hook = renderHook(() => usePlaybackControls());
      await act(async () => { await hook.result.current.seekTo(5000); });
      usePlaybackState.mockReturnValue({ state });
      hook.rerender({});
      await act(async () => { jest.advanceTimersByTime(2000); });
      expect(hook.result.current.isPlaying).toBe(true);

      // A genuine remote pause must still win even if the decoder is buffering.
      jest.mocked(usePlayWhenReady).mockReturnValue(false);
      hook.rerender({});
      expect(hook.result.current.isPlaying).toBe(false);
      hook.unmount();
    },
  );

  test('uses native playing intent during a track change without a seek', () => {
    const usePlaybackState = (TrackPlayer as unknown as { usePlaybackState: jest.Mock }).usePlaybackState;
    usePlaybackState.mockReturnValue({ state: State.Loading });
    jest.mocked(usePlayWhenReady).mockReturnValue(true);
    const hook = renderHook(() => usePlaybackControls());
    expect(hook.result.current.isPlaying).toBe(true);
    usePlaybackState.mockReturnValue({ state: State.Ended });
    hook.rerender({});
    expect(hook.result.current.isPlaying).toBe(false);
    hook.unmount();
  });

  test('keeps visible paused intent while seek-pending playback state loads', async () => {
    jest.useFakeTimers();
    const usePlaybackState = (TrackPlayer as unknown as { usePlaybackState: jest.Mock }).usePlaybackState;
    usePlaybackState.mockReturnValueOnce({ state: State.Paused });
    let resolveSeek: () => void = () => undefined;
    (TrackPlayer.seekTo as jest.Mock).mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveSeek = resolve;
    }));

    const { getByTestId, rerender } = render(<PlaybackControlsProbe />);
    expect(getByTestId('is-playing').props.children).toBe('false');

    await act(async () => {
      fireEvent.press(getByTestId('seek'));
    });

    usePlaybackState.mockReturnValue({ state: State.Loading });
    rerender(<PlaybackControlsProbe />);

    expect(getByTestId('is-playing').props.children).toBe('false');

    await act(async () => {
      resolveSeek();
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    jest.useRealTimers();
  });


  test('follows paused state during seek-pending instead of pinning playing intent', async () => {
    jest.useFakeTimers();
    const usePlaybackState = (TrackPlayer as unknown as { usePlaybackState: jest.Mock }).usePlaybackState;
    usePlaybackState.mockReturnValueOnce({ state: State.Playing });
    let resolveSeek: () => void = () => undefined;
    (TrackPlayer.seekTo as jest.Mock).mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveSeek = resolve;
    }));

    const { getByTestId, rerender } = render(<PlaybackControlsProbe />);
    expect(getByTestId('is-playing').props.children).toBe('true');

    await act(async () => {
      fireEvent.press(getByTestId('seek'));
    });

    usePlaybackState.mockReturnValue({ state: State.Paused });
    rerender(<PlaybackControlsProbe />);

    expect(getByTestId('is-playing').props.children).toBe('false');

    await act(async () => {
      resolveSeek();
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(500);
    });
  });

  test('follows stopped state during seek-pending instead of pinning playing intent', async () => {
    jest.useFakeTimers();
    const usePlaybackState = (TrackPlayer as unknown as { usePlaybackState: jest.Mock }).usePlaybackState;
    usePlaybackState.mockReturnValueOnce({ state: State.Playing });
    let resolveSeek: () => void = () => undefined;
    (TrackPlayer.seekTo as jest.Mock).mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveSeek = resolve;
    }));

    const { getByTestId, rerender } = render(<PlaybackControlsProbe />);
    expect(getByTestId('is-playing').props.children).toBe('true');

    await act(async () => {
      fireEvent.press(getByTestId('seek'));
    });

    usePlaybackState.mockReturnValue({ state: State.Stopped });
    rerender(<PlaybackControlsProbe />);

    expect(getByTestId('is-playing').props.children).toBe('false');

    await act(async () => {
      resolveSeek();
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(500);
    });
  });

  test('reflects pause toggled during seek-pending once raw state pauses', async () => {
    jest.useFakeTimers();
    const usePlaybackState = (TrackPlayer as unknown as { usePlaybackState: jest.Mock }).usePlaybackState;
    usePlaybackState.mockReturnValueOnce({ state: State.Playing });
    jest.spyOn(TrackPlayer, 'getPlaybackState').mockResolvedValueOnce({ state: State.Playing });
    let resolveSeek: () => void = () => undefined;
    (TrackPlayer.seekTo as jest.Mock).mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveSeek = resolve;
    }));

    const { getByTestId, rerender } = render(<PlaybackControlsProbe />);
    expect(getByTestId('is-playing').props.children).toBe('true');

    await act(async () => {
      fireEvent.press(getByTestId('seek'));
    });

    await act(async () => {
      fireEvent.press(getByTestId('toggle'));
    });

    expect(TrackPlayer.pause).toHaveBeenCalled();

    usePlaybackState.mockReturnValue({ state: State.Paused });
    rerender(<PlaybackControlsProbe />);

    expect(getByTestId('is-playing').props.children).toBe('false');

    await act(async () => {
      resolveSeek();
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(500);
    });
  });


  test('keeps playing through rapid seeks until native intent actually pauses', async () => {
    jest.useFakeTimers();
    const usePlaybackState = (TrackPlayer as unknown as { usePlaybackState: jest.Mock }).usePlaybackState;
    usePlaybackState.mockReturnValueOnce({ state: State.Playing });

    let resolveFirstSeek: () => void = () => undefined;
    let resolveSecondSeek: () => void = () => undefined;
    (TrackPlayer.seekTo as jest.Mock)
      .mockImplementationOnce(() => new Promise<void>((resolve) => {
        resolveFirstSeek = resolve;
      }))
      .mockImplementationOnce(() => new Promise<void>((resolve) => {
        resolveSecondSeek = resolve;
      }));

    const { getByTestId, rerender } = render(<PlaybackControlsProbe />);
    expect(getByTestId('is-playing').props.children).toBe('true');

    await act(async () => {
      fireEvent.press(getByTestId('seek'));
      fireEvent.press(getByTestId('seek'));
      await Promise.resolve();
    });

    usePlaybackState.mockReturnValue({ state: State.Buffering });
    rerender(<PlaybackControlsProbe />);

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(getByTestId('is-playing').props.children).toBe('true');

    await act(async () => {
      resolveFirstSeek();
      await Promise.resolve();
    });

    expect(TrackPlayer.seekTo).toHaveBeenCalledTimes(2);

    usePlaybackState.mockReturnValue({ state: State.Loading });
    rerender(<PlaybackControlsProbe />);

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(getByTestId('is-playing').props.children).toBe('true');

    await act(async () => {
      resolveSecondSeek();
      await Promise.resolve();
    });

    usePlaybackState.mockReturnValue({ state: State.Loading });
    rerender(<PlaybackControlsProbe />);
    expect(getByTestId('is-playing').props.children).toBe('true');

    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    rerender(<PlaybackControlsProbe />);

    expect(getByTestId('is-playing').props.children).toBe('true');
    jest.mocked(usePlayWhenReady).mockReturnValue(false);
    rerender(<PlaybackControlsProbe />);
    expect(getByTestId('is-playing').props.children).toBe('false');
  });

  test('calls transport controls in sequential user-action order', async () => {
    (TrackPlayer.skipToNext as jest.Mock).mockResolvedValueOnce(undefined);
    const hook = renderHook(() => usePlaybackControls());

    await act(async () => {
      await hook.result.current.stop();
      await hook.result.current.seekTo(5000);
      await hook.result.current.next();
      await hook.result.current.previous();
    });

    expect(TrackPlayer.stop).toHaveBeenCalled();
    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(5);
    expect(TrackPlayer.skipToNext).toHaveBeenCalled();
    expect(TrackPlayer.getProgress).toHaveBeenCalled();
    hook.unmount();
  });
});
