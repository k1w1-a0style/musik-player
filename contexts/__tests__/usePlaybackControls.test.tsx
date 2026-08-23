import React from 'react';
import { Button, Text } from 'react-native';
import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
import TrackPlayer, { State } from 'react-native-track-player';
import {
  clampVolume,
  getNextRepeatMode,
  usePlaybackControls,
} from '../usePlaybackControls';
import { resetSeekControllerForTests } from '../../utils/seekController';


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
    resetSeekControllerForTests();
    jest.clearAllMocks();
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

  test('toggles playback based on current TrackPlayer state', async () => {
    jest.spyOn(TrackPlayer, 'getPlaybackState').mockResolvedValueOnce({ state: State.Playing });
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
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
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
      jest.runOnlyPendingTimers();
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
      jest.runOnlyPendingTimers();
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
      jest.runOnlyPendingTimers();
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
      jest.runOnlyPendingTimers();
    });
  });


  test('keeps seek pending until the latest rapid seek commit settles', async () => {
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
      jest.runOnlyPendingTimers();
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
      jest.runOnlyPendingTimers();
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
      jest.runOnlyPendingTimers();
    });
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
