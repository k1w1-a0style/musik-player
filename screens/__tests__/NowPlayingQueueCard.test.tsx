import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import NowPlayingQueueCard from '../NowPlayingQueueCard';
import type { Song } from '../../types/Song';

const queue: Song[] = [
  { id: 's1', title: 'One', artist: 'A' },
  { id: 's2', title: 'Two', artist: 'B' },
  { id: 's3', title: 'Three', artist: 'C' },
];

test('renders drag handles for upcoming tracks only', () => {
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

  expect(queryByTestId('queue-drag-handle-s1')).toBeNull();
  expect(getByTestId('queue-drag-handle-s2')).toBeTruthy();
  expect(getByTestId('queue-drag-handle-s3')).toBeTruthy();

  fireEvent.press(getByTestId('queue-row-s2'));
  expect(onPlayQueueItem).toHaveBeenCalledWith('s2');
});
