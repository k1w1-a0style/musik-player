import React from 'react';
import { Button, Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import TrackPlayer, { State } from 'react-native-track-player';
import {
  clampVolume,
  getNextRepeatMode,
  usePlaybackControls,
} from '../usePlaybackControls';

const PlaybackControlsProbe = () => {
  const {
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
