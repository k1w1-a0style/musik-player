import React from 'react';
import { Pressable, Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { useSleepTimer } from '../useSleepTimer';

const SleepTimerProbe = ({ isPlaying, pausePlayback }: { isPlaying: boolean; pausePlayback: () => void }) => {
  const { sleepTimerActive, startSleepTimer, cancelSleepTimer } = useSleepTimer({ isPlaying, pausePlayback });

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
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('clears the timeout on unmount', () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const view = render(<SleepTimerProbe isPlaying pausePlayback={jest.fn()} />);

    fireEvent.press(view.getByTestId('start-15'));
    view.unmount();

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    clearTimeoutSpy.mockRestore();
  });

  test('replaces an existing timer when starting a new timer', () => {
    const pausePlayback = jest.fn();
    const { getByTestId } = render(<SleepTimerProbe isPlaying pausePlayback={pausePlayback} />);

    fireEvent.press(getByTestId('start-15'));
    fireEvent.press(getByTestId('start-30'));

    act(() => {
      jest.advanceTimersByTime(15 * 60 * 1000);
    });
    expect(pausePlayback).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(15 * 60 * 1000);
    });
    expect(pausePlayback).toHaveBeenCalledTimes(1);
  });

  test('pauses playback when the timer expires', () => {
    const pausePlayback = jest.fn();
    const { getByTestId } = render(<SleepTimerProbe isPlaying pausePlayback={pausePlayback} />);

    fireEvent.press(getByTestId('start-15'));
    act(() => {
      jest.advanceTimersByTime(15 * 60 * 1000);
    });

    expect(pausePlayback).toHaveBeenCalledTimes(1);
    expect(getByTestId('sleep-timer-active').props.children).toBe('false');
  });

  test('does not resume playback when the timer expires while already paused', () => {
    const pausePlayback = jest.fn();
    const { getByTestId } = render(<SleepTimerProbe isPlaying={false} pausePlayback={pausePlayback} />);

    fireEvent.press(getByTestId('start-15'));
    act(() => {
      jest.advanceTimersByTime(15 * 60 * 1000);
    });

    expect(pausePlayback).not.toHaveBeenCalled();
  });
});
