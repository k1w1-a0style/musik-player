import React from 'react';
import { Button, Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import TrackPlayer, { State } from 'react-native-track-player';
import {
  clampVolume,
  getNextRepeatMode,
  usePlaybackControls,
} from '../usePlaybackControls';
import { resetSeekControllerForTests } from '../../utils/seekController';

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

  test('calls transport controls', async () => {
    const { getByTestId } = render(<PlaybackControlsProbe />);

    await act(async () => {
      fireEvent.press(getByTestId('stop'));
      fireEvent.press(getByTestId('seek'));
      fireEvent.press(getByTestId('next'));
      fireEvent.press(getByTestId('previous'));
    });

    await waitFor(() => {
      expect(TrackPlayer.stop).toHaveBeenCalled();
      expect(TrackPlayer.seekTo).toHaveBeenCalledWith(5);
      expect(TrackPlayer.skipToNext).toHaveBeenCalled();
      expect(TrackPlayer.getProgress).toHaveBeenCalled();
    });
  });
});
