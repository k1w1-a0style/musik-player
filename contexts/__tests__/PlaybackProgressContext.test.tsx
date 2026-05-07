import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import TrackPlayer from 'react-native-track-player';
import { PlaybackProgressProvider, usePlaybackProgress } from '../PlaybackProgressContext';

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
  test('converts track player progress from seconds to milliseconds', () => {
    (TrackPlayer as RNTPMock).useProgress.mockReturnValue({ position: 12.5, duration: 245, buffered: 0 });

    const { getByTestId } = render(
      <PlaybackProgressProvider>
        <Probe />
      </PlaybackProgressProvider>,
    );

    expect(getByTestId('progress-position').props.children).toBe('12500');
    expect(getByTestId('progress-duration').props.children).toBe('245000');
  });
});
