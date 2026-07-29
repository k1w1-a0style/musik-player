import React from 'react';
import { Pressable, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { useNowPlayingQueue } from '../useNowPlayingQueue';
import type { Song } from '../../types/Song';
import type { NativeQueueActionResult } from '../../contexts/playbackQueueActionHelpers';

const songs: Song[] = [
  { id: 's1', title: 'One', artist: 'A' },
  { id: 's2', title: 'Two', artist: 'B' },
];

const QueueProbe = ({
  playbackQueue,
  currentSong,
  playSong,
}: {
  playbackQueue: Song[];
  currentSong: Song | null;
  playSong: (song: Song, queue?: Song[]) => Promise<NativeQueueActionResult>;
}) => {
  const { queue, playQueueItemById } = useNowPlayingQueue({ playbackQueue, currentSong, playSong });

  return (
    <>
      <Text testID="queue-count">{queue.length}</Text>
      <Pressable testID="play-s2" onPress={() => playQueueItemById('s2')} />
      <Pressable testID="play-s1" onPress={() => playQueueItemById('s1')} />
      <Pressable testID="play-missing" onPress={() => playQueueItemById('missing')} />
    </>
  );
};

describe('useNowPlayingQueue', () => {
  test('builds queue from playback queue', () => {
    const playSong = jest.fn(async () => ({ status: 'noop' as const }));
    const { getByTestId } = render(
      <QueueProbe playbackQueue={songs} currentSong={songs[0]} playSong={playSong} />,
    );

    expect(getByTestId('queue-count').props.children).toBe(2);
  });

  test('falls back to current song when playback queue is empty', () => {
    const playSong = jest.fn(async () => ({ status: 'noop' as const }));
    const { getByTestId } = render(
      <QueueProbe playbackQueue={[]} currentSong={songs[0]} playSong={playSong} />,
    );

    expect(getByTestId('queue-count').props.children).toBe(1);
  });

  test('plays queue item by id and skips current or missing ids', () => {
    const playSong = jest.fn(async () => ({ status: 'noop' as const }));
    const { getByTestId } = render(
      <QueueProbe playbackQueue={songs} currentSong={songs[0]} playSong={playSong} />,
    );

    fireEvent.press(getByTestId('play-s2'));
    fireEvent.press(getByTestId('play-s1'));
    fireEvent.press(getByTestId('play-missing'));

    expect(playSong).toHaveBeenCalledTimes(1);
    expect(playSong).toHaveBeenCalledWith(songs[1], songs);
  });
});
