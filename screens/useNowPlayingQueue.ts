import { useCallback, useMemo } from 'react';
import type { Song } from '../types/Song';
import { runPlaybackUiAction } from '../utils/playbackUiActions';
import { buildNowPlayingQueue, buildQueueById } from './nowPlayingHelpers';
import type { NativeQueueActionResult } from '../contexts/playbackQueueActionHelpers';

interface UseNowPlayingQueueArgs {
  playbackQueue: Song[];
  currentSong: Song | null;
  playSong: (song: Song, queue?: Song[]) => Promise<NativeQueueActionResult>;
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
    void runPlaybackUiAction('queue-play-song', () => playSong(item, queue), { dropIfPending: true });
  }, [currentSong?.id, playSong, queue, queueById]);

  return { queue, playQueueItemById };
};
