import React from 'react';
import { Pressable, Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import TrackPlayer from 'react-native-track-player';
import { formatSleepTimerRemaining, useSleepTimer } from '../useSleepTimer';
import { isSleepTimerActive, resetSleepTimerForTests } from '../../services/sleepTimerController';

const SleepTimerProbe = () => {
  const { sleepTimerActive, sleepTimerRemainingSeconds, startSleepTimer, cancelSleepTimer } = useSleepTimer();

  return (
    <>
      <Text testID="sleep-timer-active">{String(sleepTimerActive)}</Text>
      <Text testID="sleep-timer-remaining">{String(sleepTimerRemainingSeconds)}</Text>
      <Pressable testID="start-15" onPress={() => startSleepTimer(15)} />
      <Pressable testID="start-30" onPress={() => startSleepTimer(30)} />
      <Pressable testID="cancel" onPress={cancelSleepTimer} />
    </>
  );
};

describe('useSleepTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    resetSleepTimerForTests();
    jest.clearAllMocks();
  });

  afterEach(() => {
    resetSleepTimerForTests();
    jest.useRealTimers();
  });

  test.each([
    [59, '00:59'],
    [15 * 60, '15:00'],
    [59 * 60 + 5, '59:05'],
    [60 * 60, '1:00:00'],
  ])('formats %i seconds as %s', (seconds, expected) => {
    expect(formatSleepTimerRemaining(seconds)).toBe(expected);
  });

  test('keeps the shared timer active on unmount', () => {
    const view = render(<SleepTimerProbe />);

    fireEvent.press(view.getByTestId('start-15'));
    view.unmount();

    expect(isSleepTimerActive()).toBe(true);
  });

  test('remount detects an already active timer', () => {
    const first = render(<SleepTimerProbe />);
    fireEvent.press(first.getByTestId('start-15'));
    first.unmount();

    const second = render(<SleepTimerProbe />);

    expect(second.getByTestId('sleep-timer-active').props.children).toBe('true');
    expect(second.getByTestId('sleep-timer-remaining').props.children).toBe('900');
  });

  test('updates remaining time and replacement immediately', () => {
    const { getByTestId } = render(<SleepTimerProbe />);

    fireEvent.press(getByTestId('start-15'));
    expect(getByTestId('sleep-timer-remaining').props.children).toBe('900');

    act(() => {
      jest.setSystemTime(new Date('2026-01-01T00:00:04.000Z'));
      jest.advanceTimersByTime(1000);
    });
    expect(getByTestId('sleep-timer-remaining').props.children).toBe('895');

    fireEvent.press(getByTestId('start-30'));
    expect(getByTestId('sleep-timer-remaining').props.children).toBe('1800');
  });

  test('cancel sets active and remaining inactive', () => {
    const { getByTestId } = render(<SleepTimerProbe />);

    fireEvent.press(getByTestId('start-15'));
    fireEvent.press(getByTestId('cancel'));

    expect(getByTestId('sleep-timer-active').props.children).toBe('false');
    expect(getByTestId('sleep-timer-remaining').props.children).toBe('null');
  });

  test('clears the countdown interval on unmount without deleting the shared timer', () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const view = render(<SleepTimerProbe />);

    fireEvent.press(view.getByTestId('start-15'));
    view.unmount();

    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    expect(isSleepTimerActive()).toBe(true);
    clearIntervalSpy.mockRestore();
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

  test('pauses playback once when the timer expires', async () => {
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
    expect(getByTestId('sleep-timer-remaining').props.children).toBe('null');
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
