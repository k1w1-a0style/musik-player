import { useCallback, useMemo } from 'react';
import type { Song } from '../types/Song';
import { buildNowPlayingQueue, buildQueueById } from './nowPlayingHelpers';

interface UseNowPlayingQueueArgs {
  playbackQueue: Song[];
  currentSong: Song | null;
  playSong: (song: Song, queue?: Song[]) => Promise<void>;
}

interface NowPlayingQueueState {
  queue: Song[];
  playQueueItemById: (songId: string) => void;
}

export const useNowPlayingQueue = ({
  playbackQueue,
  currentSong,
  playSong,
}: UseNowPlayingQueueArgs): NowPlayingQueueState => {
  const queue = useMemo(
    () => buildNowPlayingQueue(playbackQueue, currentSong),
    [playbackQueue, currentSong],
  );

  const queueById = useMemo(() => buildQueueById(queue), [queue]);

  const playQueueItemById = useCallback((songId: string) => {
    const item = queueById.get(songId);
    if (!item || item.id === currentSong?.id) return;
    void playSong(item, queue);
  }, [currentSong?.id, playSong, queue, queueById]);

  return { queue, playQueueItemById };
};
