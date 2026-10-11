import React from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import TrackPlayer from 'react-native-track-player';
import { PlaybackProgressProvider, usePlaybackProgress } from '../PlaybackProgressContext';
import { setPlaybackProgressVisible } from '../../utils/playbackProgressVisibility';

type RNTPMock = typeof TrackPlayer & { useProgress: jest.Mock };

const Probe: React.FC = () => {
  const { position, duration } = usePlaybackProgress();
  return (
    <>
      <Text testID="progress-position">{String(position)}</Text>
      <Text testID="progress-duration">{String(duration)}</Text>
    </>
  );
};

describe('PlaybackProgressContext', () => {
  beforeEach(() => { setPlaybackProgressVisible(true); });
  afterEach(() => { act(() => { setPlaybackProgressVisible(true); }); });

  test('passes navigation visibility to the actual backend-hook contract', () => {
    const view = render(<PlaybackProgressProvider><Probe /></PlaybackProgressProvider>);
    act(() => { setPlaybackProgressVisible(false); });
    expect((TrackPlayer as RNTPMock).useProgress).toHaveBeenLastCalledWith(500, { enabled: false });
    act(() => { setPlaybackProgressVisible(true); });
    expect((TrackPlayer as RNTPMock).useProgress).toHaveBeenLastCalledWith(500, { enabled: true });
    view.unmount();
  });
  test('converts track player progress from seconds to milliseconds exactly once', () => {
    (TrackPlayer as RNTPMock).useProgress.mockReturnValue({ position: 12.5, duration: 245, buffered: 0 });

    const { getByTestId } = render(
      <PlaybackProgressProvider>
        <Probe />
      </PlaybackProgressProvider>,
    );

    expect(getByTestId('progress-position').props.children).toBe('12500');
    expect(getByTestId('progress-duration').props.children).toBe('245000');
  });

  test('keeps millisecond values stable for UI consumers instead of double converting', () => {
    (TrackPlayer as RNTPMock).useProgress.mockReturnValue({ position: 1, duration: 2, buffered: 0 });

    const { getByTestId } = render(
      <PlaybackProgressProvider>
        <Probe />
      </PlaybackProgressProvider>,
    );

    expect(getByTestId('progress-position').props.children).toBe('1000');
    expect(getByTestId('progress-duration').props.children).toBe('2000');
  });

  test('passes the expected update interval to TrackPlayer useProgress', () => {
    (TrackPlayer as RNTPMock).useProgress.mockReturnValue({ position: 0, duration: 0, buffered: 0 });

    render(
      <PlaybackProgressProvider>
        <Probe />
      </PlaybackProgressProvider>,
    );

    expect((TrackPlayer as RNTPMock).useProgress).toHaveBeenCalledWith(500, { enabled: true });
  });

  test('keeps progress rendering stable when duration is zero', () => {
    (TrackPlayer as RNTPMock).useProgress.mockReturnValue({ position: 0, duration: 0, buffered: 0 });

    const { getByTestId } = render(
      <PlaybackProgressProvider>
        <Probe />
      </PlaybackProgressProvider>,
    );

    expect(getByTestId('progress-position').props.children).toBe('0');
    expect(getByTestId('progress-duration').props.children).toBe('0');
  });

});
