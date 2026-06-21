import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import NowPlayingQueueCard from '../NowPlayingQueueCard';
import type { Song } from '../../types/Song';

const queue: Song[] = [
  { id: 's1', title: 'One', artist: 'A' },
  { id: 's2', title: 'Two', artist: 'B' },
  { id: 's3', title: 'Three', artist: 'C' },
];

test('renders queue order controls for upcoming tracks', () => {
  const onPlayQueueItem = jest.fn();
  const onQueueShift = jest.fn();
  const { getByTestId, queryByTestId } = render(
    <NowPlayingQueueCard
      queue={queue}
      currentSongId="s1"
      maxHeight={240}
      onPlayQueueItem={onPlayQueueItem}
      onQueueShift={onQueueShift}
      canShiftQueue
    />,
  );

  expect(queryByTestId('queue-shift-controls-s1')).toBeNull();
  expect(getByTestId('queue-shift-controls-s2')).toBeTruthy();

  fireEvent.press(getByTestId('queue-shift-down-s2'));
  expect(onQueueShift).toHaveBeenCalledWith(1, 2);

  fireEvent.press(getByTestId('queue-shift-up-s3'));
  expect(onQueueShift).toHaveBeenCalledWith(2, 1);
});
