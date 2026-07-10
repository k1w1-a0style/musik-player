import React from 'react';
import { Pressable, Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import TrackPlayer from 'react-native-track-player';
import { useSleepTimer } from '../useSleepTimer';
import { resetSleepTimerForTests } from '../../services/sleepTimerController';

const SleepTimerProbe = () => {
  const { sleepTimerActive, startSleepTimer, cancelSleepTimer } = useSleepTimer();

  return (
    <>
      <Text testID="sleep-timer-active">{String(sleepTimerActive)}</Text>
      <Pressable testID="start-15" onPress={() => startSleepTimer(15)} />
      <Pressable testID="start-30" onPress={() => startSleepTimer(30)} />
      <Pressable testID="cancel" onPress={cancelSleepTimer} />
    </>
  );
};

describe('useSleepTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetSleepTimerForTests();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('clears the timeout on unmount', () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const view = render(<SleepTimerProbe />);

    fireEvent.press(view.getByTestId('start-15'));
    view.unmount();

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    clearTimeoutSpy.mockRestore();
  });

  test('replaces an existing timer when starting a new timer', async () => {
    await TrackPlayer.play();
    jest.clearAllMocks();
    const { getByTestId } = render(<SleepTimerProbe />);

    fireEvent.press(getByTestId('start-15'));
    fireEvent.press(getByTestId('start-30'));

    act(() => {
      jest.advanceTimersByTime(15 * 60 * 1000);
    });
    expect(TrackPlayer.pause).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(15 * 60 * 1000);
      await Promise.resolve();
    });
    expect(TrackPlayer.pause).toHaveBeenCalledTimes(1);
  });

  test('pauses playback when the timer expires', async () => {
    await TrackPlayer.play();
    jest.clearAllMocks();
    const { getByTestId } = render(<SleepTimerProbe />);

    fireEvent.press(getByTestId('start-15'));
    await act(async () => {
      jest.advanceTimersByTime(15 * 60 * 1000);
      await Promise.resolve();
    });

    expect(TrackPlayer.pause).toHaveBeenCalledTimes(1);
    expect(getByTestId('sleep-timer-active').props.children).toBe('false');
  });

  test('does not resume playback when the timer expires while already paused', async () => {
    const { getByTestId } = render(<SleepTimerProbe />);
    await TrackPlayer.pause();
    jest.clearAllMocks();

    fireEvent.press(getByTestId('start-15'));
    await act(async () => {
      jest.advanceTimersByTime(15 * 60 * 1000);
      await Promise.resolve();
    });

    expect(TrackPlayer.pause).not.toHaveBeenCalled();
  });
});
